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
 * Simülasyon girdi verisi (BDG2 bina tüketimi, NSRDB güneş, tarife) ve simülasyon çalıştırma kayıtları.
 * Core Engine'e giden 24 saatlik girdi bu tablolardan üretilir.
 */
async function initSimulationDataTables(client: PoolClient): Promise<void> {
  // Saatlik bina tüketimi (BDG2'den içe aktarılır). Aynı (time, building_type, source) tekrar yazılabilir.
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

  // Saatlik güneş üretimi (NSRDB'den içe aktarılır)
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

  // Core Engine'e gönderilen istek ve dönen sonuç (Frontend geçmiş çalıştırmaları buradan okur)
  await client.query(`
    CREATE TABLE IF NOT EXISTS simulation_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      data_date DATE,
      request JSONB NOT NULL,
      result JSONB NOT NULL
    );
  `);

  for (const table of ['building_demand_readings', 'solar_readings']) {
    await client
      .query(`SELECT create_hypertable('${table}', 'time', if_not_exists => TRUE);`)
      .catch(() => {
        // TimescaleDB yoksa düz PostgreSQL tablosu olarak devam et
      });
  }

  console.log('[Database] Simülasyon veri tabloları hazır.');
}

/**
 * TimescaleDB bağlantı kontrolü ve Hypertable başlatma fonksiyonu
 */
export async function initDatabase(): Promise<void> {
  const client = await dbPool.connect();
  try {
    console.log('[Database] PostgreSQL bağlantısı başarılı.');

    // 1. TimescaleDB Eklentisi Kontrolü
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;');
      console.log('[Database] TimescaleDB eklentisi aktif.');
    } catch (extError: any) {
      console.warn('[Database] TimescaleDB eklentisi uyarısı (düz PostgreSQL olarak devam edebilir):', extError.message);
    }

    // 2. Zaman Serisi Tablosu: energy_metrics
    await client.query(`
      CREATE TABLE IF NOT EXISTS energy_metrics (
        time TIMESTAMPTZ NOT NULL,
        building_id VARCHAR(50) NOT NULL,
        building_type VARCHAR(50) NOT NULL,
        demand_kwh DOUBLE PRECISION NOT NULL,
        allocated_kwh DOUBLE PRECISION NOT NULL,
        unserved_kwh DOUBLE PRECISION NOT NULL,
        solar_generation_kwh DOUBLE PRECISION NOT NULL,
        battery_level_kwh DOUBLE PRECISION NOT NULL,
        grid_imported_kwh DOUBLE PRECISION NOT NULL,
        strategy_type VARCHAR(20) NOT NULL
      );
    `);

    // 3. TimescaleDB Hypertable'a Dönüştürme
    await client.query(`
      SELECT create_hypertable('energy_metrics', 'time', if_not_exists => TRUE);
    `).catch(() => {
      // Hypertable zaten varsa veya TimescaleDB kurulu değilse sessizce devam et
    });

    console.log('[Database] "energy_metrics" zaman serisi tablosu hazır.');

    await initSimulationDataTables(client);
  } catch (error) {
    console.error('[Database] Veritabanı başlatma hatası:', error);
    throw error;
  } finally {
    client.release();
  }
}

