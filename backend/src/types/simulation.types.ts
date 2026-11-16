import { BuildingDemand, StrategyDecisionResult } from './energy.types';

export interface SimulationScenarioConfig {
  scenarioName: string;
  durationHours: number; // Varsayılan: 24 saat
  gridOutageStartHour?: number; // Örn: 14. saatte şebeke kesildi
  gridOutageDurationHours?: number; // Örn: 4 saat sürdü
  cloudyDayFactor?: number; // 0.0 (kapalı) - 1.0 (tam güneşli)
  batteryCapacityKWh: number;
  initialBatteryKWh: number;
  priceModel: 'FLAT' | 'TIME_OF_USE'; // Sabit vs Çok zamanlı tarife (TOU)
}

export interface HourlyEnvironmentProfile {
  hour: number;
  timestamp: string;
  solarGenerationKWh: number;
  gridElectricityPrice: number;
  isGridAvailable: boolean;
  buildings: BuildingDemand[];
}

export interface StrategyComparisonMetrics {
  totalDemandKWh: number;
  totalSolarUsedKWh: number;
  totalBatteryDischargedKWh: number;
  totalGridImportKWh: number;
  totalUnservedEnergyKWh: number;
  totalElectricityCostUSD: number;
  criticalBuildingsUptimePercent: number; // Laboratory ve Library kesintisiz çalışma oranı (%)
  dormitorySheddingHours: number; // Yurdun elektriğinin kesildiği saat sayısı
  decisions: StrategyDecisionResult[];
}

export interface SimulationComparisonReport {
  scenarioName: string;
  durationHours: number;
  basicStrategyReport: StrategyComparisonMetrics;
  smartStrategyReport: StrategyComparisonMetrics;
  savingsUSD: number;
  unservedEnergyReductionPercent: number;
  summaryVerdict: string;
}

