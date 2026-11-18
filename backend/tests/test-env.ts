// Testler yerel .env dosyasından bağımsız, sabit ortak varsayılanlarla çalışmalıdır.
// dotenv zaten tanımlı ortam değişkenlerini ezmez; bu dosya ENV'den ÖNCE import edilmelidir.
process.env.CRITICAL_BUILDINGS = 'LABORATORY';
process.env.BATTERY_MIN_RESERVE_PERCENT = '25';
process.env.BATTERY_MAX_CAPACITY_KWH = '100';
process.env.SIMULATION_HIGH_PRICE_THRESHOLD = '2.5';
process.env.SIMULATION_OUTAGE_LOOKAHEAD_HOURS = '3';
