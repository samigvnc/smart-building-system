import dotenv from 'dotenv';
import { BuildingType } from '../types/energy.types';
dotenv.config();

/** Boş/geçersiz değerde varsayılanı döner; 0 geçerli bir değerdir. */
function numberOr(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseBuildingTypes(value: string | undefined, fallback: BuildingType[]): BuildingType[] {
  if (!value || value.trim() === '') return fallback;
  const valid = new Set<string>(Object.values(BuildingType));
  const parsed = value
    .split(',')
    .map((v) => v.trim().toUpperCase())
    .filter((v) => v.length > 0);
  const unknown = parsed.filter((v) => !valid.has(v));
  if (unknown.length > 0) {
    throw new Error(`CRITICAL_BUILDINGS geçersiz bina tipi içeriyor: ${unknown.join(', ')}`);
  }
  return parsed as BuildingType[];
}

export const ENV = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB: {
    HOST: process.env.DB_HOST || 'localhost',
    PORT: Number(process.env.DB_PORT) || 5432,
    USER: process.env.DB_USER || 'postgres',
    PASSWORD: process.env.DB_PASSWORD || 'postgres',
    NAME: process.env.DB_NAME || 'smart_building_db',
  },
  RABBITMQ: {
    URL: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    SENSOR_QUEUE: process.env.RABBITMQ_SENSOR_QUEUE || 'sensor_data_queue',
    CORE_ENGINE_QUEUE: process.env.RABBITMQ_CORE_ENGINE_QUEUE || 'core_engine_queue',
  },
  /**
   * Backend ile Core Engine (Java) arasında ORTAK varsayılanlar.
   * Core Engine'deki SmartStrategyConfig.defaultConfig() ve kritik bina listesiyle aynı tutulmalıdır.
   */
  SIMULATION: {
    CRITICAL_BUILDINGS: parseBuildingTypes(process.env.CRITICAL_BUILDINGS, [BuildingType.LABORATORY]),
    HIGH_PRICE_THRESHOLD: numberOr(process.env.SIMULATION_HIGH_PRICE_THRESHOLD, 2.5),
    OUTAGE_LOOKAHEAD_HOURS: numberOr(process.env.SIMULATION_OUTAGE_LOOKAHEAD_HOURS, 3),
    CORE_ENGINE_TIMEOUT_MS: numberOr(process.env.CORE_ENGINE_TIMEOUT_MS, 15000),
  },
  STRATEGY_DEFAULTS: {
    BATTERY_MIN_RESERVE_PERCENT: numberOr(process.env.BATTERY_MIN_RESERVE_PERCENT, 25),
    BATTERY_MAX_CAPACITY_KWH: numberOr(process.env.BATTERY_MAX_CAPACITY_KWH, 100),
  },
  /** NSRDB (NLR/NREL) API: https://developer.nlr.gov/docs/solar/nsrdb/ — anahtar ve e-posta kullanıcıya aittir. */
  NSRDB: {
    BASE_URL: process.env.NSRDB_BASE_URL || 'https://developer.nlr.gov/api/nsrdb/v2/solar/',
    ENDPOINT: process.env.NSRDB_ENDPOINT || 'nsrdb-GOES-aggregated-v4-0-0-download.csv',
    API_KEY: process.env.NSRDB_API_KEY || '',
    EMAIL: process.env.NSRDB_EMAIL || '',
    FULL_NAME: process.env.NSRDB_FULL_NAME || 'Smart Building System',
    AFFILIATION: process.env.NSRDB_AFFILIATION || 'Student project',
  },
};
