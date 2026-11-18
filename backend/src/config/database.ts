import { Pool, PoolClient } from 'pg';
import { ENV } from './env';

export const dbPool = new Pool({
  host: ENV.DB.HOST,
  port: ENV.DB.PORT,
  user: ENV.DB.USER,
  password: ENV.DB.PASSWORD,
  database: ENV.DB.NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Backend'in sorumluluğu veri saklama ve aktarımdır; karar/strateji mantığı Core Engine'dedir.
 *
 * Veri akışı:
 *   BDG2 ham veri ──► bdg2_buildings + bdg2_electricity_readings   (ham, değiştirilmeden)
 *   NSRDB (API)   ──► nsrdb_ghi_readings                            (ham)
 *   profil eşleme ──► building_demand_readings + solar_readings     (Core Engine'in okuduğu hazır profiller)
 *   tarife        ──► grid_price_profile
 *   Core Engine   ──► simulation_runs                               (istek + sonuç kaydı)
 *   sensör akışı  ──► sensor_telemetry                              (ham telemetri)
 *
 * Zaman damgası notu: BDG2 ve NSRDB saatleri "bina/saha yerel saati" olarak, duvar saati değiştirilmeden
 * TIMESTAMPTZ(UTC etiketli) saklanır. Böylece "günün 0-23. saati" yerel saat anlamına gelir.
 */
async function initTables(client: PoolClient): Promise<void> {
  /* ---------- BDG2 ham veri ---------- */
  await client.query(`
    CREATE TABLE IF NOT EXISTS bdg2_buildings (
      building_id VARCHAR(100) PRIMARY KEY,
      site_id VARCHAR(50) NOT NULL,
      primary_space_usage VARCHAR(100),
      sub_primary_space_usage VARCHAR(100),
      sqm DOUBLE PRECISION,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      timezone VARCHAR(50),
      year_built INTEGER,
      occupants INTEGER,
      has_electricity BOOLEAN NOT NULL DEFAULT FALSE
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS bdg2_buildings_site_idx ON bdg2_buildings (site_id);`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS bdg2_electricity_readings (
      time TIMESTAMPTZ NOT NULL,
      building_id VARCHAR(100) NOT NULL,
      kwh DOUBLE PRECISION NOT NULL CHECK (kwh >= 0)
    );
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS bdg2_electricity_readings_uq
      ON bdg2_electricity_readings (building_id, time);
  `);

  /* ---------- NSRDB ham veri ---------- */
  await client.query(`
    CREATE TABLE IF NOT EXISTS nsrdb_ghi_readings (
      site_id VARCHAR(50) NOT NULL,
      time TIMESTAMPTZ NOT NULL,
      ghi_wm2 DOUBLE PRECISION NOT NULL CHECK (ghi_wm2 >= 0),
      PRIMARY KEY (site_id, time)
    );
  `);

  /* ---------- Core Engine'in okuduğu hazır profiller ---------- */
  await client.query(`
    CREATE TABLE IF NOT EXISTS building_demand_readings (
      time TIMESTAMPTZ NOT NULL,
      building_type VARCHAR(50) NOT NULL,
      demand_kwh DOUBLE PRECISION NOT NULL CHECK (demand_kwh >= 0),
      source VARCHAR(50) NOT NULL DEFAULT 'bdg2'
    );
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS building_demand_readings_uq
      ON building_demand_readings (time, building_type, source);
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS solar_readings (
      time TIMESTAMPTZ NOT NULL,
      generation_kwh DOUBLE PRECISION NOT NULL CHECK (generation_kwh >= 0),
      source VARCHAR(50) NOT NULL DEFAULT 'nsrdb'
    );
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS solar_readings_uq ON solar_readings (time, source);
  `);

  // Günün saatine göre elektrik tarifesi (para birimi/kWh)
  await client.query(`
    CREATE TABLE IF NOT EXISTS grid_price_profile (
      hour SMALLINT PRIMARY KEY CHECK (hour BETWEEN 0 AND 23),
      price_per_kwh DOUBLE PRECISION NOT NULL CHECK (price_per_kwh >= 0)
    );
  `);

  /* ---------- Core Engine çalıştırma kayıtları ---------- */
  await client.query(`
    CREATE TABLE IF NOT EXISTS simulation_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      data_date DATE,
      request JSONB NOT NULL,
      result JSONB NOT NULL
    );
  `);

  /* ---------- Ham sensör telemetrisi (Data Streaming servisi) ---------- */
  await client.query(`
    CREATE TABLE IF NOT EXISTS sensor_telemetry (
      time TIMESTAMPTZ NOT NULL,
      event_id VARCHAR(100) NOT NULL,
      building_id VARCHAR(100) NOT NULL,
      building_type VARCHAR(50) NOT NULL,
      demand_kwh DOUBLE PRECISION NOT NULL,
      solar_output_kwh DOUBLE PRECISION NOT NULL,
      battery_capacity_kwh DOUBLE PRECISION NOT NULL,
      grid_status VARCHAR(20) NOT NULL,
      grid_price_per_kwh DOUBLE PRECISION NOT NULL
    );
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS sensor_telemetry_uq ON sensor_telemetry (time, event_id, building_id);
  `);

  for (const table of [
    'bdg2_electricity_readings',
    'building_demand_readings',
    'solar_readings',
    'sensor_telemetry',
  ]) {
    await client
      .query(`SELECT create_hypertable('${table}', 'time', if_not_exists => TRUE, migrate_data => TRUE);`)
      .catch(() => {
        // TimescaleDB yoksa düz PostgreSQL tablosu olarak devam et
      });
  }

  console.log('[Database] Tablolar hazır.');
}

/**
 * TimescaleDB bağlantı kontrolü ve tabloların oluşturulması
 */
export async function initDatabase(): Promise<void> {
  const client = await dbPool.connect();
  try {
    console.log('[Database] PostgreSQL bağlantısı başarılı.');

    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;');
      console.log('[Database] TimescaleDB eklentisi aktif.');
    } catch (extError: any) {
      console.warn('[Database] TimescaleDB eklentisi uyarısı (düz PostgreSQL olarak devam edebilir):', extError.message);
    }

    await initTables(client);
  } catch (error) {
    console.error('[Database] Veritabanı başlatma hatası:', error);
    throw error;
  } finally {
    client.release();
  }
}
