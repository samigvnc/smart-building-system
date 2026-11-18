export enum BuildingType {
  LABORATORY = 'LABORATORY',
  LIBRARY = 'LIBRARY',
  DORMITORY = 'DORMITORY',
  CAFETERIA = 'CAFETERIA',
}

export interface BuildingDemand {
  id: string;
  name: string;
  type: BuildingType;
  isCritical: boolean;
  demandKWh: number;
}

export interface BatteryState {
  currentCapacityKWh: number;
  maxCapacityKWh: number;
  minReservePercent: number; // Varsayılan: %25 (Core Engine ile ortak)
  chargeEfficiency?: number;
  dischargeEfficiency?: number;
}

export interface EnergyEnvironmentInput {
  timestamp: string | Date;
  solarGenerationKWh: number;
  buildings: BuildingDemand[];
  battery: BatteryState;
  isGridAvailable: boolean; // Şebeke kesintisi kontrolü
  gridElectricityPrice: number; // Para birimi/kWh (veri setindeki birimle aynı)
  priceThresholdCheap?: number; // Canlı karar için ucuz fiyat eşiği (arbitraj)
}

export interface BuildingEnergyAllocation {
  buildingId: string;
  buildingName: string;
  type: BuildingType;
  requestedKWh: number;
  allocatedKWh: number;
  unservedKWh: number;
  isShedded: boolean;
}

export interface StrategyDecisionResult {
  timestamp: string | Date;
  strategyUsed: 'BASIC' | 'SMART';
  totalDemandKWh: number;
  solarUsedKWh: number;
  batteryChargedKWh: number;
  batteryDischargedKWh: number;
  gridImportKWh: number;
  unservedEnergyKWh: number;
  finalBatteryCapacityKWh: number;
  finalBatteryPercentage: number;
  allocations: BuildingEnergyAllocation[];
  notes: string[];
}
