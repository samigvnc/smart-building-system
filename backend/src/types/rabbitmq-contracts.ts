import { BuildingType } from './energy.types';

/**
 * Core Engine (Java simülasyon motoru) mesajları için bkz. ./simulation-contract.ts
 */

/**
 * Data Streaming (Socket.io) -> RabbitMQ (sensor_data_queue) -> Backend
 * Sensörlerden gelen anlık telemetri paketi. Backend yalnızca saklar; karar vermez.
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
