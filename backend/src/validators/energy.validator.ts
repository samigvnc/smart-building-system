import { z } from 'zod';
import { BuildingType } from '../types/energy.types';

export const buildingDemandSchema = z.object({
  id: z.string().min(1, 'Bina ID zorunludur.'),
  name: z.string().min(1, 'Bina adı zorunludur.'),
  type: z.nativeEnum(BuildingType, {
    errorMap: () => ({ message: 'Geçersiz bina tipi. Değerler: LABORATORY, LIBRARY, DORMITORY olmalıdır.' }),
  }),
  isCritical: z.boolean(),
  demandKWh: z.number().min(0, 'Talep edilen enerji (kWh) 0 veya daha büyük olmalıdır.'),
});

export const batteryStateSchema = z.object({
  currentCapacityKWh: z.number().min(0, 'Batarya mevcut kapasitesi negatif olamaz.'),
  maxCapacityKWh: z.number().positive('Batarya maksimum kapasitesi pozitif olmalıdır.'),
  minReservePercent: z.number().min(0).max(100).default(20),
  chargeEfficiency: z.number().min(0).max(1).optional(),
  dischargeEfficiency: z.number().min(0).max(1).optional(),
}).refine((v) => v.currentCapacityKWh <= v.maxCapacityKWh, {
  path: ['currentCapacityKWh'],
  message: 'Batarya mevcut kapasitesi maksimum kapasiteyi aşamaz.',
});

export const simulateStepSchema = z.object({
  strategy: z.enum(['BASIC', 'SMART'], {
    errorMap: () => ({ message: 'Strateji BASIC veya SMART olmalıdır.' }),
  }),
  environment: z.object({
    timestamp: z.string().or(z.date()),
    solarGenerationKWh: z.number().min(0, 'Güneş üretimi negatif olamaz.'),
    buildings: z.array(buildingDemandSchema).min(1, 'En az bir bina verisi gereklidir.'),
    battery: batteryStateSchema,
    isGridAvailable: z.boolean(),
    gridElectricityPrice: z.number().min(0, 'Elektrik fiyatı negatif olamaz.'),
    priceThresholdCheap: z.number().min(0).optional(),
  }),
});

export const metricsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export const aggregatedQuerySchema = z.object({
  interval: z.enum(['15 minutes', '1 hour', '1 day']).default('1 hour'),
});

export const runScenarioSchema = z.object({
  scenarioName: z.string().optional(),
  durationHours: z.number().int().positive().max(168).default(24), // Max 1 hafta (168 saat)
  gridOutageStartHour: z.number().int().min(0).optional(),
  gridOutageDurationHours: z.number().int().min(0).optional(),
  cloudyDayFactor: z.number().min(0).max(1).default(1.0),
  batteryCapacityKWh: z.number().positive().default(120),
  initialBatteryKWh: z.number().min(0).default(60),
  priceModel: z.enum(['FLAT', 'TIME_OF_USE']).default('TIME_OF_USE'),
  saveToDatabase: z.boolean().default(false),
}).refine((v) => v.initialBatteryKWh <= v.batteryCapacityKWh, {
  path: ['initialBatteryKWh'],
  message: 'Başlangıç batarya seviyesi batarya kapasitesini aşamaz.',
});

