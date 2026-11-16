import { ENV } from '../config/env';
import { BuildingType, EnergyEnvironmentInput } from '../types/energy.types';
import { SensorDataEvent } from '../types/rabbitmq-contracts';

/**
 * Sensör telemetrisini (SensorDataEvent) strateji motorunun girdisine (EnergyEnvironmentInput) çevirir.
 * Batarya kapasitesi/rezerv/fiyat eşiği sensörden gelmez; konfigürasyondan (ENV) alınır.
 */
export function sensorEventToEnvironment(event: SensorDataEvent): EnergyEnvironmentInput {
  const maxCapacity = ENV.STRATEGY_DEFAULTS.BATTERY_MAX_CAPACITY_KWH;

  return {
    timestamp: event.timestamp,
    solarGenerationKWh: event.solarPanelOutputKWh,
    buildings: event.readings.map((r) => ({
      id: r.buildingId,
      name: r.buildingName,
      type: r.buildingType,
      isCritical: r.buildingType !== BuildingType.DORMITORY,
      demandKWh: r.currentDemandKWh,
    })),
    battery: {
      // Sensör ölçümü kapasiteyi aşarsa (kalibrasyon hatası) şarj hesabı negatif çıkmasın
      currentCapacityKWh: Math.min(event.batteryCurrentCapacityKWh, maxCapacity),
      maxCapacityKWh: maxCapacity,
      minReservePercent: ENV.STRATEGY_DEFAULTS.BATTERY_MIN_RESERVE_PERCENT,
    },
    isGridAvailable: event.gridStatus === 'CONNECTED',
    gridElectricityPrice: event.currentGridPricePerKWh,
    priceThresholdCheap: ENV.STRATEGY_DEFAULTS.ELECTRICITY_CHEAP_PRICE_THRESHOLD,
  };
}
