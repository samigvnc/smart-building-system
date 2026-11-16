import { dbPool } from '../config/database';
import { StrategyDecisionResult } from '../types/energy.types';

export class TimescaleService {
  /**
   * Strateji sonucundaki her bina dağıtımını TimescaleDB'ye kaydeder.
   */
  public async logEnergyMetrics(decision: StrategyDecisionResult): Promise<void> {
    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO energy_metrics (
          time,
          building_id,
          building_type,
          demand_kwh,
          allocated_kwh,
          unserved_kwh,
          solar_generation_kwh,
          battery_level_kwh,
          grid_imported_kwh,
          strategy_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
      `;

      // Şebeke alımı bina başına satır yazıldığı için binaların aldığı enerji payına göre bölünür;
      // böylece SUM(grid_imported_kwh) gerçek toplam alıma eşit kalır (tekrar saymayı önler).
      const totalAllocated = decision.allocations.reduce((s, a) => s + a.allocatedKWh, 0);
      const count = decision.allocations.length;

      for (const alloc of decision.allocations) {
        const share = totalAllocated > 0 ? alloc.allocatedKWh / totalAllocated : 1 / count;
        const buildingGridImport = Number((decision.gridImportKWh * share).toFixed(4));

        await client.query(insertQuery, [
          decision.timestamp,
          alloc.buildingId,
          alloc.type,
          alloc.requestedKWh,
          alloc.allocatedKWh,
          alloc.unservedKWh,
          decision.solarUsedKWh,
          decision.finalBatteryCapacityKWh,
          buildingGridImport,
          decision.strategyUsed,
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[TimescaleService] Metrik kaydetme hatası:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * React ve Chart.js için son N saatlik veya belirli aralıktaki ham zaman serisi verilerini çeker
   */
  public async getRecentMetrics(limit = 100): Promise<any[]> {
    const query = `
      SELECT 
        time,
        building_id,
        building_type,
        demand_kwh,
        allocated_kwh,
        unserved_kwh,
        solar_generation_kwh,
        battery_level_kwh,
        grid_imported_kwh,
        strategy_type
      FROM energy_metrics
      ORDER BY time DESC
      LIMIT $1;
    `;
    const res = await dbPool.query(query, [limit]);
    return res.rows;
  }

  /**
   * TimescaleDB time_bucket() fonksiyonunu kullanarak Chart.js için
   * saatlik veya günlük downsampled (özetlenmiş) veri döner.
   */
  public async getAggregatedMetrics(bucketInterval: '1 hour' | '15 minutes' | '1 day' = '1 hour'): Promise<any[]> {
    const query = `
      SELECT 
        time_bucket($1::interval, time) AS bucket,
        strategy_type,
        ROUND(AVG(demand_kwh)::numeric, 2) AS avg_demand,
        ROUND(SUM(demand_kwh)::numeric, 2) AS total_demand,
        ROUND(SUM(allocated_kwh)::numeric, 2) AS total_allocated,
        ROUND(SUM(unserved_kwh)::numeric, 2) AS total_unserved,
        ROUND(SUM(grid_imported_kwh)::numeric, 2) AS total_grid_import,
        ROUND(AVG(solar_generation_kwh)::numeric, 2) AS avg_solar,
        ROUND(AVG(battery_level_kwh)::numeric, 2) AS avg_battery
      FROM energy_metrics
      GROUP BY bucket, strategy_type
      ORDER BY bucket DESC
      LIMIT 100;
    `;
    const res = await dbPool.query(query, [bucketInterval]);
    return res.rows;
  }
}

