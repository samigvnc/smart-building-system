import { Pool } from 'pg';
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
  } catch (error) {
    console.error('[Database] Veritabanı başlatma hatası:', error);
    throw error;
  } finally {
    client.release();
  }
}

