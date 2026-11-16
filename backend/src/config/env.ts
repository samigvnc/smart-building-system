import dotenv from 'dotenv';
dotenv.config();

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
    DECISIONS_QUEUE: process.env.RABBITMQ_ENERGY_DECISIONS_QUEUE || 'energy_decisions_queue',
  },
  STRATEGY_DEFAULTS: {
    BATTERY_MIN_RESERVE_PERCENT: Number(process.env.BATTERY_MIN_RESERVE_PERCENT) || 20,
    BATTERY_MAX_CAPACITY_KWH: Number(process.env.BATTERY_MAX_CAPACITY_KWH) || 100,
    ELECTRICITY_CHEAP_PRICE_THRESHOLD: Number(process.env.ELECTRICITY_CHEAP_PRICE_THRESHOLD) || 0.15,
  },
};

