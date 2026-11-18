import { createApp } from './app';
import { ENV } from './config/env';
import { dbPool, initDatabase } from './config/database';
import { RabbitMQService } from './message-brokers/rabbitmq.service';
import { SensorTelemetryRepository } from './repositories/sensor-telemetry.repository';
import { sensorDataEventSchema } from './validators/sensor.validator';

async function bootstrap() {
  const app = createApp();

  // 1. Veritabanı tablolarını hazırla
  try {
    await initDatabase();
  } catch (err: any) {
    console.warn('[Bootstrap] Veritabanı bağlantı uyarısı (PostgreSQL servisi çalışıyor mu?):', err.message);
  }

  // 2. RabbitMQ: sensör telemetrisini yalnızca SAKLA (karar verme işi Core Engine'dedir).
  // Handler önce kaydedilir; broker geç gelse bile bağlanınca otomatik abone olunur.
  const rabbitmq = RabbitMQService.getInstance();
  const telemetryRepository = new SensorTelemetryRepository();

  await rabbitmq.consumeQueue(ENV.RABBITMQ.SENSOR_QUEUE, async (raw) => {
    // Şema dışı mesaj ZodError fırlatır -> dead_letter_queue'ya taşınır
    const event = sensorDataEventSchema.parse(raw);
    await telemetryRepository.save(event);
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
    console.log(`⚡ Simulation (Core Engine): POST http://localhost:${ENV.PORT}/api/simulation/run`);
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
