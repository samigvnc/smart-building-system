import { BuildingType } from './energy.types';

/**
 * Backend (Node.js) <-> Core Engine (Java simülasyon motoru) ORTAK SÖZLEŞMESİ.
 *
 * Alan adları, Java tarafındaki record'larla birebir aynıdır (SimulationRequest, ScenarioCondition,
 * SmartStrategyConfig, HourlyInput, BuildingLoad, StrategyComparisonResult, HourlyResult,
 * BuildingEnergyResult, SimulationSummary). Java'da değişiklik olursa bu dosya ve
 * backend/docs/core-engine-contract.md birlikte güncellenmelidir.
 */

export type ScenarioType = 'NORMAL_DAY' | 'CLOUDY_DAY' | 'GRID_OUTAGE' | 'BATTERY_FAILURE' | 'DEMAND_SPIKE';

export const SCENARIO_TYPES: readonly ScenarioType[] = [
  'NORMAL_DAY',
  'CLOUDY_DAY',
  'GRID_OUTAGE',
  'BATTERY_FAILURE',
  'DEMAND_SPIKE',
];

export interface ScenarioCondition {
  type: ScenarioType;
  startHour: number; // 0-23
  endHour: number; // 0-23, startHour <= endHour
  factor: number; // CLOUDY_DAY: 0..1 (güneş çarpanı), DEMAND_SPIKE: >=1 (talep çarpanı), diğerleri: 1
}

export interface SmartStrategyConfig {
  minimumReservePercent: number; // 0-100
  highPriceThreshold: number; // >= 0, para birimi/kWh
  outageLookAheadHours: number; // >= 0
}

export interface BuildingLoad {
  buildingType: BuildingType;
  critical: boolean;
  demandKwh: number;
}

export interface HourlyInput {
  hour: number; // 0-23, sıralı ve tam 24 adet
  demandKwh: number; // buildingLoads toplamına eşit olmalı
  buildingLoads: BuildingLoad[];
  solarGenerationKwh: number;
  gridAvailable: boolean;
  batteryAvailable: boolean;
  gridPricePerKwh: number;
}

/** Backend -> core_engine_queue (RabbitMQ RPC isteği) */
export interface SimulationEngineRequest {
  taskId: string;
  requestedAt: string;
  batteryCapacityKwh: number;
  initialBatterySocKwh: number;
  criticalBuildings: BuildingType[];
  scenarioConditions: ScenarioCondition[];
  smartStrategyConfig: SmartStrategyConfig;
  /** Backend'in DB'den (BDG2 / NSRDB / tarife) hazırladığı 24 saatlik girdi. */
  hourlyInputs: HourlyInput[];
}

export interface BuildingEnergyResult {
  buildingType: BuildingType;
  critical: boolean;
  demandKwh: number;
  servedEnergyKwh: number;
  unservedEnergyKwh: number;
}

export interface HourlyResult {
  hour: number;
  demandKwh: number;
  solarAvailableKwh: number;
  solarToLoadKwh: number;
  solarToBatteryKwh: number;
  batteryToLoadKwh: number;
  gridToLoadKwh: number;
  unservedEnergyKwh: number;
  curtailedSolarKwh: number;
  batterySocEndKwh: number;
  cost: number;
  buildingResults: BuildingEnergyResult[];
}

export interface SimulationSummary {
  strategyName: string;
  totalCost: number;
  gridUsageKwh: number;
  solarUsageKwh: number;
  batteryUsageKwh: number;
  unservedEnergyKwh: number;
  renewableUtilizationPercent: number;
  finalBatterySocKwh: number;
}

export interface StrategySimulationResult {
  summary: SimulationSummary;
  hourlyResults: HourlyResult[];
}

export interface StrategyComparisonResult {
  basic: StrategySimulationResult;
  smart: StrategySimulationResult;
}

/** core_engine_queue yanıtı (replyTo kuyruğuna, aynı correlationId ile) */
export interface SimulationEngineResponse {
  taskId: string;
  status: 'OK' | 'ERROR';
  errorMessage?: string;
  result?: StrategyComparisonResult;
}
