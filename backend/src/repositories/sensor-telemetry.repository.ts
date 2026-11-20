import { dbPool } from '../config/database';
import { SensorDataEvent } from '../types/rabbitmq-contracts';

/** Sensör telemetrisini ham haliyle saklar (bina başına bir satır). Aynı olay tekrar gelirse yok sayılır. */
export class SensorTelemetryRepository {
  public async save(event: SensorDataEvent): Promise<void> {
    const r = event.readings;
    await dbPool.query(
      `INSERT INTO sensor_telemetry
         (time, event_id, building_id, building_type, demand_kwh,
          solar_output_kwh, battery_capacity_kwh, grid_status, grid_price_per_kwh)
       SELECT $1::timestamptz, $2, b.id, b.type, b.demand, $3, $4, $5, $6
         FROM unnest($7::text[], $8::text[], $9::float8[]) AS b(id, type, demand)
       ON CONFLICT (time, event_id, building_id) DO NOTHING`,
      [
        event.timestamp,
        event.eventId,
        event.solarPanelOutputKWh,
        event.batteryCurrentCapacityKWh,
        event.gridStatus,
        event.currentGridPricePerKWh,
        r.map((x) => x.buildingId),
        r.map((x) => x.buildingType),
        r.map((x) => x.currentDemandKWh),
      ]
    );
  }
}
