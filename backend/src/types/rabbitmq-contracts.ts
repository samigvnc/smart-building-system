import { BuildingType, StrategyDecisionResult } from './energy.types';

/**
 * Core Engine (Java simülasyon motoru) mesajları için bkz. ./simulation-contract.ts
 * (Backend -> core_engine_queue RPC isteği ve yanıtı burada DEĞİL, orada tanımlıdır.)
 */

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
 * 2. Backend -> RabbitMQ (energy_decisions_queue) -> Frontend Socket.io / Dashboard
 * Gerçekleşen kararın yayını.
 */
export interface LiveDecisionBroadcastEvent {
  eventType: 'ENERGY_DECISION_UPDATED';
  timestamp: string;
  decision: StrategyDecisionResult;
}
