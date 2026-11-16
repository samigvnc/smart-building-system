import { createApp } from './app';
import { ENV } from './config/env';
import { dbPool, initDatabase } from './config/database';
import { RabbitMQService } from './message-brokers/rabbitmq.service';
import { EnergyStrategyService } from './services/energy-strategy.service';
import { TimescaleService } from './services/timescale.service';
import { sensorDataEventSchema } from './validators/sensor.validator';
import { sensorEventToEnvironment } from './mappers/sensor-event.mapper';
import { LiveDecisionBroadcastEvent } from './types/rabbitmq-contracts';

async function bootstrap() {
  const app = createApp();

  // 1. Veritabanı ve TimescaleDB Hypertable başlatma
  try {
    await initDatabase();
  } catch (err: any) {
    console.warn('[Bootstrap] Veritabanı bağlantı uyarısı (PostgreSQL servisi çalışıyor mu?):', err.message);
  }

  // 2. RabbitMQ Başlatma ve Consumer Kurulumu
  const rabbitmq = RabbitMQService.getInstance();
  const strategyService = new EnergyStrategyService();
  const timescaleService = new TimescaleService();

  // Data Streaming servisinden gelen canlı sensör verilerini dinle.
  // Handler önce kaydedilir; broker geç gelse bile bağlanınca otomatik abone olunur.
  await rabbitmq.consumeQueue(ENV.RABBITMQ.SENSOR_QUEUE, async (raw) => {
    // Şema dışı mesaj ZodError fırlatır -> dead_letter_queue'ya taşınır
    const event = sensorDataEventSchema.parse(raw);
    const decision = strategyService.executeSmartStrategy(sensorEventToEnvironment(event));

    // DB hatası kararın yayınlanmasını engellemesin
    try {
      await timescaleService.logEnergyMetrics(decision);
    } catch (err: any) {
      console.warn('[Consumer] Metrik DB\'ye yazılamadı:', err.message);
    }

    const broadcast: LiveDecisionBroadcastEvent = {
      eventType: 'ENERGY_DECISION_UPDATED',
      timestamp: new Date().toISOString(),
      decision,
    };
    await rabbitmq.publishToQueue(ENV.RABBITMQ.DECISIONS_QUEUE, broadcast);
  });

  try {
    await rabbitmq.connect();
  } catch (err: any) {
    console.warn('[Bootstrap] RabbitMQ bağlantı uyarısı, yeniden denenecek:', err.message);
    rabbitmq.scheduleReconnect();
  }

  // 3. HTTP Sunucusunu Başlat
  const server = app.listen(ENV.PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Smart Building System Backend: http://localhost:${ENV.PORT}`);
    console.log(`📊 Health Check: http://localhost:${ENV.PORT}/api/health`);
    console.log(`⚡ Scenario Simulator: POST http://localhost:${ENV.PORT}/api/energy/run-scenario`);
    console.log(`====================================================`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Shutdown] ${signal} alındı, kapatılıyor...`);
    server.close();
    await rabbitmq.close();
    await dbPool.end().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Uygulama başlatılamadı:', err);
  process.exit(1);
});
