import { dbPool } from '../config/database';
import { BuildingType } from '../types/energy.types';
import { StrategyComparisonResult, SimulationEngineRequest } from '../types/simulation-contract';

/** 24 saatlik (UTC, 0-23) değer dizisi; eksik saat `undefined`. */
export type DayValues = (number | undefined)[];

export interface SimulationDataRepository {
  /** Verilen günün (UTC) bina bazında saatlik tüketimi. */
  getDemandForDay(date: string, source?: string): Promise<Map<BuildingType, DayValues>>;
  /** Verilen günün (UTC) saatlik güneş üretimi. */
  getSolarForDay(date: string, source?: string): Promise<DayValues>;
  /** Günün saatine göre tarife (24 değer). */
  getPriceProfile(): Promise<DayValues>;
  /** Güneş verisi 24 saati tam olan en son gün (YYYY-MM-DD) veya null. */
  findLatestCompleteDay(source?: string): Promise<string | null>;
}

export interface SimulationRunRecord {
  id: string;
  createdAt: string;
  dataDate: string | null;
  request: SimulationEngineRequest;
  result: StrategyComparisonResult;
}

export interface SimulationRunsRepository {
  save(dataDate: string | null, request: SimulationEngineRequest, result: StrategyComparisonResult): Promise<string>;
  findById(id: string): Promise<SimulationRunRecord | null>;
  list(limit: number): Promise<Omit<SimulationRunRecord, 'request' | 'result'>[]>;
}

// Günü UTC sınırlarıyla [start, end) olarak ele alan ortak koşul
const DAY_WINDOW_SQL = `
  time >= ($1::date)::timestamp AT TIME ZONE 'UTC'
  AND time < (($1::date)::timestamp + interval '1 day') AT TIME ZONE 'UTC'
`;

function emptyDay(): DayValues {
  return new Array<number | undefined>(24).fill(undefined);
}

export class PgSimulationDataRepository implements SimulationDataRepository {
  public async getDemandForDay(date: string, source?: string): Promise<Map<BuildingType, DayValues>> {
    const res = await dbPool.query(
      `SELECT building_type,
              EXTRACT(HOUR FROM time AT TIME ZONE 'UTC')::int AS hour,
              AVG(demand_kwh) AS value
         FROM building_demand_readings
        WHERE ${DAY_WINDOW_SQL}
          AND ($2::text IS NULL OR source = $2)
        GROUP BY building_type, hour`,
      [date, source ?? null]
    );

    const byBuilding = new Map<BuildingType, DayValues>();
    for (const row of res.rows) {
      const type = row.building_type as BuildingType;
      if (!byBuilding.has(type)) byBuilding.set(type, emptyDay());
      byBuilding.get(type)![row.hour] = Number(row.value);
    }
    return byBuilding;
  }

  public async getSolarForDay(date: string, source?: string): Promise<DayValues> {
    const res = await dbPool.query(
      `SELECT EXTRACT(HOUR FROM time AT TIME ZONE 'UTC')::int AS hour,
              AVG(generation_kwh) AS value
         FROM solar_readings
        WHERE ${DAY_WINDOW_SQL}
          AND ($2::text IS NULL OR source = $2)
        GROUP BY hour`,
      [date, source ?? null]
    );
    const values = emptyDay();
    for (const row of res.rows) values[row.hour] = Number(row.value);
    return values;
  }

  public async getPriceProfile(): Promise<DayValues> {
    const res = await dbPool.query('SELECT hour, price_per_kwh FROM grid_price_profile');
    const values = emptyDay();
    for (const row of res.rows) values[row.hour] = Number(row.price_per_kwh);
    return values;
  }

  public async findLatestCompleteDay(source?: string): Promise<string | null> {
    const res = await dbPool.query(
      `SELECT d::text AS day FROM (
         SELECT (time AT TIME ZONE 'UTC')::date AS d,
                COUNT(DISTINCT EXTRACT(HOUR FROM time AT TIME ZONE 'UTC')) AS hours
           FROM solar_readings
          WHERE ($1::text IS NULL OR source = $1)
          GROUP BY d
       ) t
       WHERE hours = 24
       ORDER BY d DESC
       LIMIT 1`,
      [source ?? null]
    );
    return res.rows[0]?.day ?? null;
  }
}

export class PgSimulationRunsRepository implements SimulationRunsRepository {
  public async save(
    dataDate: string | null,
    request: SimulationEngineRequest,
    result: StrategyComparisonResult
  ): Promise<string> {
    const res = await dbPool.query(
      `INSERT INTO simulation_runs (data_date, request, result)
       VALUES ($1, $2::jsonb, $3::jsonb)
       RETURNING id`,
      [dataDate, JSON.stringify(request), JSON.stringify(result)]
    );
    return res.rows[0].id;
  }

  public async findById(id: string): Promise<SimulationRunRecord | null> {
    const res = await dbPool.query(
      `SELECT id, created_at, data_date::text AS data_date, request, result
         FROM simulation_runs WHERE id = $1`,
      [id]
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      createdAt: row.created_at.toISOString(),
      dataDate: row.data_date,
      request: row.request,
      result: row.result,
    };
  }

  public async list(limit: number): Promise<Omit<SimulationRunRecord, 'request' | 'result'>[]> {
    const res = await dbPool.query(
      `SELECT id, created_at, data_date::text AS data_date
         FROM simulation_runs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return res.rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at.toISOString(),
      dataDate: row.data_date,
    }));
  }
}
