export enum BuildingType {
  LABORATORY = 'LABORATORY',
  LIBRARY = 'LIBRARY',
  DORMITORY = 'DORMITORY',
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
  minReservePercent: number; // Varsayılan: %20
  chargeEfficiency?: number;
  dischargeEfficiency?: number;
}

export interface EnergyEnvironmentInput {
  timestamp: string | Date;
  solarGenerationKWh: number;
  buildings: BuildingDemand[];
  battery: BatteryState;
  isGridAvailable: boolean; // Şebeke kesintisi kontrolü
  gridElectricityPrice: number; // $/kWh veya TL/kWh
  priceThresholdCheap?: number; // Fiyat arbitrajı eşik değeri (örn: 0.15 $/kWh)
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

