import amqp from 'amqplib';
import { SensorDataEvent } from '../src/types/rabbitmq-contracts';
import { BuildingType } from '../src/types/energy.types';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const QUEUE_NAME = 'sensor_data_queue';

async function runMockStreamingProducer() {
  console.log('[Mock Streaming Producer] RabbitMQ bağlanılıyor:', RABBITMQ_URL);
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  console.log(`[Mock Streaming Producer] Başlatıldı. Her 3 saniyede bir "${QUEUE_NAME}" kuyruğuna sensör telemetrisi basılacak... (Durdurmak için Ctrl+C)`);

  let step = 0;

  setInterval(() => {
    step++;
    const now = new Date();

    // 0 ile 50 kWh arası simüle edilmiş güneş enerjisi
    const solarOutput = Number((Math.max(0, Math.sin(step * 0.2) * 45) + Math.random() * 5).toFixed(2));
    const isOutage = step % 15 === 0; // Her 15 adımda bir anlık şebeke kesintisi simülasyonu
    const price = step % 8 === 0 ? 0.35 : 0.12;

    const event: SensorDataEvent = {
      eventId: `telemetry-evt-${Date.now()}`,
      timestamp: now.toISOString(),
      source: 'DATA_STREAMING_SERVICE',
      solarPanelOutputKWh: solarOutput,
      batteryCurrentCapacityKWh: 45.0,
      gridStatus: isOutage ? 'OUTAGE' : 'CONNECTED',
      currentGridPricePerKWh: price,
      readings: [
        {
          buildingId: 'bld-lab-01',
          buildingName: 'Biyoteknoloji Laboratuvarı',
          buildingType: BuildingType.LABORATORY,
          currentDemandKWh: Number((25 + Math.random() * 5).toFixed(2)),
          voltage: 230,
        },
        {
          buildingId: 'bld-lib-01',
          buildingName: 'Merkez Kütüphane',
          buildingType: BuildingType.LIBRARY,
          currentDemandKWh: Number((15 + Math.random() * 3).toFixed(2)),
          voltage: 230,
        },
        {
          buildingId: 'bld-dorm-01',
          buildingName: 'Öğrenci Yurdu A Blok',
          buildingType: BuildingType.DORMITORY,
          currentDemandKWh: Number((30 + Math.random() * 8).toFixed(2)),
          voltage: 230,
        },
      ],
    };

    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(event)), { persistent: true });
    console.log(`[Sent Telemetry #${step}] Solar: ${solarOutput} kWh | Grid: ${event.gridStatus} | Fiyat: ${price} $/kWh`);
  }, 3000);
}

runMockStreamingProducer().catch((err) => {
  console.error('[Mock Streaming Producer] Hata:', err);
});
