import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sensorDataEventSchema } from '../src/validators/sensor.validator';
import { sensorEventToEnvironment } from '../src/mappers/sensor-event.mapper';
import { EnergyStrategyService } from '../src/services/energy-strategy.service';
import { BuildingType } from '../src/types/energy.types';

const validEvent = {
  eventId: 'evt-1',
  timestamp: '2026-11-07T12:00:00.000Z',
  source: 'DATA_STREAMING_SERVICE',
  solarPanelOutputKWh: 15,
  batteryCurrentCapacityKWh: 20,
  gridStatus: 'OUTAGE',
  currentGridPricePerKWh: 0.25,
  readings: [
    { buildingId: 'b1', buildingName: 'Lab', buildingType: 'LABORATORY', currentDemandKWh: 20 },
    { buildingId: 'b2', buildingName: 'Lib', buildingType: 'LIBRARY', currentDemandKWh: 15 },
    { buildingId: 'b3', buildingName: 'Dorm', buildingType: 'DORMITORY', currentDemandKWh: 25 },
  ],
};

describe('Sensör mesajı doğrulama ve mapper', () => {
  it('Geçerli SensorDataEvent kabul edilir ve strateji girdisine doğru çevrilir', () => {
    const event = sensorDataEventSchema.parse(validEvent);
    const env = sensorEventToEnvironment(event);

    assert.strictEqual(env.isGridAvailable, false);
    assert.strictEqual(env.solarGenerationKWh, 15);
    assert.strictEqual(env.buildings.length, 3);
    assert.strictEqual(env.buildings.find((b) => b.type === BuildingType.DORMITORY)?.isCritical, false);
    assert.strictEqual(env.buildings.find((b) => b.type === BuildingType.LABORATORY)?.isCritical, true);
  });

  it('Sensörden gelen mesaj Smart stratejiyle uçtan uca işlenir (kesintide yurt kesilir)', () => {
    const env = sensorEventToEnvironment(sensorDataEventSchema.parse(validEvent));
    const result = new EnergyStrategyService().executeSmartStrategy(env);
    const dorm = result.allocations.find((a) => a.type === BuildingType.DORMITORY);
    assert.strictEqual(dorm?.isShedded, true);
  });

  it('Eksik/yanlış alanlı mesaj reddedilir', () => {
    assert.throws(() => sensorDataEventSchema.parse({ ...validEvent, readings: [] }));
    assert.throws(() => sensorDataEventSchema.parse({ ...validEvent, gridStatus: 'UNKNOWN' }));
    assert.throws(() => sensorDataEventSchema.parse({ ...validEvent, timestamp: 'not-a-date' }));
    assert.throws(() => sensorDataEventSchema.parse({ buildings: [] })); // eski/yanlış format
  });

  it('Batarya ölçümü kapasiteyi aşarsa kapasiteye kırpılır', () => {
    const env = sensorEventToEnvironment(
      sensorDataEventSchema.parse({ ...validEvent, batteryCurrentCapacityKWh: 99999 })
    );
    assert.strictEqual(env.battery.currentCapacityKWh, env.battery.maxCapacityKWh);
  });

  it('minReservePercent=0 verilirse 20\'ye çevrilmez', () => {
    const env = sensorEventToEnvironment(sensorDataEventSchema.parse({ ...validEvent, gridStatus: 'CONNECTED' }));
    env.battery.minReservePercent = 0;
    env.gridElectricityPrice = 0.5; // pahalı -> batarya kullanılır
    env.battery.currentCapacityKWh = 50;
    env.solarGenerationKWh = 0;
    const result = new EnergyStrategyService().executeSmartStrategy(env);
    // Talep 60: rezerv 0 olduğu için 50 kWh'nin tamamı kullanılabilir
    assert.strictEqual(result.batteryDischargedKWh, 50);
  });
});
