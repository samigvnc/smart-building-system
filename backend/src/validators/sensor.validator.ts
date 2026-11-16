import { z } from 'zod';
import { BuildingType } from '../types/energy.types';

/**
 * sensor_data_queue üzerinden gelen SensorDataEvent için çalışma zamanı doğrulaması.
 * Kontrat: src/types/rabbitmq-contracts.ts
 */
export const sensorDataEventSchema = z.object({
  eventId: z.string().min(1),
  timestamp: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Geçersiz timestamp'),
  source: z.literal('DATA_STREAMING_SERVICE'),
  solarPanelOutputKWh: z.number().min(0),
  batteryCurrentCapacityKWh: z.number().min(0),
  gridStatus: z.enum(['CONNECTED', 'OUTAGE']),
  currentGridPricePerKWh: z.number().min(0),
  readings: z
    .array(
      z.object({
        buildingId: z.string().min(1),
        buildingName: z.string().min(1),
        buildingType: z.nativeEnum(BuildingType),
        currentDemandKWh: z.number().min(0),
        powerFactor: z.number().optional(),
        voltage: z.number().optional(),
      })
    )
    .min(1),
});
