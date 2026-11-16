import { BuildingType, StrategyDecisionResult } from './energy.types';

/**
 * 1. Data Streaming (Socket.io) -> RabbitMQ (sensor_data_queue) -> Backend
 * Sensörlerden gelen anlık telemetri paketi.
 */
export interface SensorDataEvent {
  eventId: string;
  timestamp: string;
  source: 'DATA_STREAMING_SERVICE';
  solarPanelOutputKWh: number;
  batteryCurrentCapacityKWh: number;
  gridStatus: 'CONNECTED' | 'OUTAGE';
  currentGridPricePerKWh: number;
  readings: {
    buildingId: string;
    buildingName: string;
    buildingType: BuildingType;
    currentDemandKWh: number;
    powerFactor?: number;
    voltage?: number;
  }[];
}

/**
 * 2. Backend -> RabbitMQ (core_engine_queue) -> Java Spring Boot Core Engine
 * Karmaşık lineer programlama / optimizasyon istekleri.
 */
export interface CoreEngineOptimizationRequest {
  taskId: string;
  requestedAt: string;
  optimizationHorizonHours: number;
  objective: 'MINIMIZE_COST' | 'MAXIMIZE_RELIABILITY' | 'BALANCED';
  weatherForecastSolarKWh: number[];
  buildingDemandForecasts: {
    buildingId: string;
    forecastedDemandKWh: number[];
  }[];
  priceForecastUSD: number[];
  batteryConstraints: {
    maxCapacityKWh: number;
    minReservePercent: number;
    maxChargeRateKW: number;
    maxDischargeRateKW: number;
  };
}

/**
 * 3. Java Spring Boot -> RabbitMQ -> Backend
 * Solver optimizasyon çözüm çıktısı.
 */
export interface CoreEngineOptimizationResponse {
  taskId: string;
  solvedAt: string;
  status: 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE';
  executionTimeMs: number;
  recommendedSchedule: {
    hourIndex: number;
    chargeBatteryKWh: number;
    dischargeBatteryKWh: number;
    gridImportKWh: number;
    sheddedBuildings: string[];
  }[];
}

/**
 * 4. Backend -> RabbitMQ (energy_decisions_queue) -> Frontend Socket.io / Dashboard
 * Gerçekleşen kararın yayını.
 */
export interface LiveDecisionBroadcastEvent {
  eventType: 'ENERGY_DECISION_UPDATED';
  timestamp: string;
  decision: StrategyDecisionResult;
}

