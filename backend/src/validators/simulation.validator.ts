import { z } from 'zod';
import { ENV } from '../config/env';
import { BuildingType } from '../types/energy.types';

const buildingTypeSchema = z.nativeEnum(BuildingType, {
  errorMap: () => ({
    message: `Geçersiz bina tipi. Değerler: ${Object.values(BuildingType).join(', ')}`,
  }),
});

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-MM-DD biçiminde olmalıdır.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Geçersiz tarih.');

const hourSchema = z.number().int().min(0).max(23);

export const scenarioConditionSchema = z
  .object({
    type: z.enum(['NORMAL_DAY', 'CLOUDY_DAY', 'GRID_OUTAGE', 'BATTERY_FAILURE', 'DEMAND_SPIKE']),
    startHour: hourSchema,
    endHour: hourSchema,
    factor: z.number().default(1),
  })
  .superRefine((c, ctx) => {
    if (c.startHour > c.endHour) {
      ctx.addIssue({ code: 'custom', path: ['startHour'], message: 'startHour, endHour değerinden büyük olamaz.' });
    }
    if (c.type === 'CLOUDY_DAY' && (c.factor < 0 || c.factor > 1)) {
      ctx.addIssue({ code: 'custom', path: ['factor'], message: 'CLOUDY_DAY çarpanı 0 ile 1 arasında olmalıdır.' });
    }
    if (c.type === 'DEMAND_SPIKE' && c.factor < 1) {
      ctx.addIssue({ code: 'custom', path: ['factor'], message: 'DEMAND_SPIKE çarpanı en az 1 olmalıdır.' });
    }
  });

export const smartStrategyConfigSchema = z.object({
  minimumReservePercent: z.number().min(0).max(100).default(ENV.STRATEGY_DEFAULTS.BATTERY_MIN_RESERVE_PERCENT),
  highPriceThreshold: z.number().min(0).default(ENV.SIMULATION.HIGH_PRICE_THRESHOLD),
  outageLookAheadHours: z.number().int().min(0).default(ENV.SIMULATION.OUTAGE_LOOKAHEAD_HOURS),
});

/** POST /api/simulation/run gövdesi. Verilmeyen alanlar ortak varsayılanlardan (ENV) gelir. */
export const simulationRunSchema = z
  .object({
    batteryCapacityKwh: z.number().positive().default(ENV.STRATEGY_DEFAULTS.BATTERY_MAX_CAPACITY_KWH),
    initialBatterySocKwh: z.number().min(0).optional(), // verilmezse kapasitenin %50'si
    criticalBuildings: z.array(buildingTypeSchema).default([...ENV.SIMULATION.CRITICAL_BUILDINGS]),
    scenarioConditions: z.array(scenarioConditionSchema).max(50).default([]),
    smartStrategyConfig: smartStrategyConfigSchema.default({}),
    date: dateSchema.optional(),
    source: z.string().min(1).max(50).optional(),
  })
  .refine((v) => v.initialBatterySocKwh === undefined || v.initialBatterySocKwh <= v.batteryCapacityKwh, {
    path: ['initialBatterySocKwh'],
    message: 'Başlangıç batarya seviyesi batarya kapasitesini aşamaz.',
  });

export type SimulationRunParams = z.infer<typeof simulationRunSchema>;

/** GET /api/simulation/inputs sorgusu */
export const simulationInputsQuerySchema = z.object({
  date: dateSchema.optional(),
  source: z.string().min(1).max(50).optional(),
  criticalBuildings: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : undefined))
    .pipe(z.array(buildingTypeSchema).optional()),
});

export const runsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export const runIdParamSchema = z.object({
  id: z.string().uuid('Geçersiz çalıştırma kimliği.'),
});

/* ---------- Core Engine yanıtı (Java record'larıyla aynı alan adları) ---------- */

const buildingResultSchema = z.object({
  buildingType: buildingTypeSchema,
  critical: z.boolean(),
  demandKwh: z.number(),
  servedEnergyKwh: z.number(),
  unservedEnergyKwh: z.number(),
});

const hourlyResultSchema = z.object({
  hour: z.number().int(),
  demandKwh: z.number(),
  solarAvailableKwh: z.number(),
  solarToLoadKwh: z.number(),
  solarToBatteryKwh: z.number(),
  batteryToLoadKwh: z.number(),
  gridToLoadKwh: z.number(),
  unservedEnergyKwh: z.number(),
  curtailedSolarKwh: z.number(),
  batterySocEndKwh: z.number(),
  cost: z.number(),
  buildingResults: z.array(buildingResultSchema),
});

const summarySchema = z.object({
  strategyName: z.string(),
  totalCost: z.number(),
  gridUsageKwh: z.number(),
  solarUsageKwh: z.number(),
  batteryUsageKwh: z.number(),
  unservedEnergyKwh: z.number(),
  renewableUtilizationPercent: z.number(),
  finalBatterySocKwh: z.number(),
});

const strategyResultSchema = z.object({
  summary: summarySchema,
  hourlyResults: z.array(hourlyResultSchema),
});

export const simulationEngineResponseSchema = z.object({
  taskId: z.string(),
  status: z.enum(['OK', 'ERROR']),
  errorMessage: z.string().optional().nullable(),
  result: z
    .object({
      basic: strategyResultSchema,
      smart: strategyResultSchema,
    })
    .optional()
    .nullable(),
});
