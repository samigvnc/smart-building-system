/**
 * Simülasyon girdi verisini (bina tüketimi, güneş, tarife) veritabanına aktarır.
 *
 *   npm run seed:dev                              -> Core Engine'in dev CSV'lerini (src/main/resources/data) DB'ye yükler
 *   npm run import:data -- demand <dosya.csv> [--source bdg2]   timestamp,building_type,demand_kwh
 *   npm run import:data -- solar  <dosya.csv> [--source nsrdb]   timestamp,generation_kwh
 *   npm run import:data -- price  <dosya.csv>                    hour,price_per_kwh
 *
 * Zaman damgaları ISO-8601 olmalıdır (saat dilimi yoksa UTC kabul edilir).
 * Gerçek BDG2 dosyası (geniş biçim: sütun = bina) için önce uzun biçime dönüştürücü yazılacaktır.
 */
import fs from 'node:fs';
import path from 'node:path';
import { dbPool, initDatabase } from '../src/config/database';
import { BuildingType } from '../src/types/energy.types';
import { parseCsv, toNonNegativeNumber } from '../src/utils/csv';

const CHUNK = 5000;

function readCsv(file: string): Record<string, string>[] {
  if (!fs.existsSync(file)) throw new Error(`Dosya bulunamadı: ${file}`);
  return parseCsv(fs.readFileSync(file, 'utf-8'));
}

function toIso(value: string, label: string): string {
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(' ', 'T')}Z`;
  const t = Date.parse(normalized);
  if (Number.isNaN(t)) throw new Error(`${label} geçersiz zaman damgası: "${value}"`);
  return new Date(t).toISOString();
}

async function insertDemand(rows: { time: string; type: string; value: number; source: string }[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const c = rows.slice(i, i + CHUNK);
    await dbPool.query(
      `INSERT INTO building_demand_readings (time, building_type, demand_kwh, source)
       SELECT * FROM unnest($1::timestamptz[], $2::text[], $3::float8[], $4::text[])
       ON CONFLICT (time, building_type, source) DO UPDATE SET demand_kwh = EXCLUDED.demand_kwh`,
      [c.map((r) => r.time), c.map((r) => r.type), c.map((r) => r.value), c.map((r) => r.source)]
    );
  }
}

async function insertSolar(rows: { time: string; value: number; source: string }[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const c = rows.slice(i, i + CHUNK);
    await dbPool.query(
      `INSERT INTO solar_readings (time, generation_kwh, source)
       SELECT * FROM unnest($1::timestamptz[], $2::float8[], $3::text[])
       ON CONFLICT (time, source) DO UPDATE SET generation_kwh = EXCLUDED.generation_kwh`,
      [c.map((r) => r.time), c.map((r) => r.value), c.map((r) => r.source)]
    );
  }
}

async function insertPrice(rows: { hour: number; value: number }[]) {
  for (const r of rows) {
    await dbPool.query(
      `INSERT INTO grid_price_profile (hour, price_per_kwh) VALUES ($1, $2)
       ON CONFLICT (hour) DO UPDATE SET price_per_kwh = EXCLUDED.price_per_kwh`,
      [r.hour, r.value]
    );
  }
}

function parseDemandFile(file: string, source: string) {
  return readCsv(file).map((r, i) => {
    const type = (r['building_type'] ?? '').toUpperCase();
    if (!Object.values(BuildingType).includes(type as BuildingType)) {
      throw new Error(`Satır ${i + 2}: geçersiz building_type "${r['building_type']}"`);
    }
    return {
      time: toIso(r['timestamp'], `Satır ${i + 2}`),
      type,
      value: toNonNegativeNumber(r['demand_kwh'], `Satır ${i + 2} demand_kwh`),
      source,
    };
  });
}

function parseSolarFile(file: string, source: string) {
  return readCsv(file).map((r, i) => ({
    time: toIso(r['timestamp'], `Satır ${i + 2}`),
    value: toNonNegativeNumber(r['generation_kwh'], `Satır ${i + 2} generation_kwh`),
    source,
  }));
}

function parsePriceFile(file: string) {
  return readCsv(file).map((r, i) => {
    const hour = Number(r['hour']);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error(`Satır ${i + 2}: hour 0-23 olmalı.`);
    return { hour, value: toNonNegativeNumber(r['price_per_kwh'], `Satır ${i + 2} price_per_kwh`) };
  });
}

/** Core Engine'in 24 satırlık (hour,value) geliştirme CSV'lerini referans bir güne yerleştirir. */
async function seedDev(dataDir: string) {
  const SOURCE = 'dev';
  const DATE = '2026-01-01';
  const hourly = (file: string) =>
    readCsv(file).map((r) => ({
      hour: Number(r['hour']),
      value: toNonNegativeNumber(r['value'], `${path.basename(file)} value`),
    }));
  const ts = (hour: number) => `${DATE}T${String(hour).padStart(2, '0')}:00:00.000Z`;

  const buildings: [BuildingType, string][] = [
    [BuildingType.DORMITORY, 'dev/dormitory.csv'],
    [BuildingType.LIBRARY, 'dev/library.csv'],
    [BuildingType.LABORATORY, 'dev/laboratory.csv'],
    [BuildingType.CAFETERIA, 'dev/cafeteria.csv'],
  ];

  const demandRows = buildings.flatMap(([type, rel]) =>
    hourly(path.join(dataDir, rel)).map((r) => ({ time: ts(r.hour), type, value: r.value, source: SOURCE }))
  );
  const solarRows = hourly(path.join(dataDir, 'solar.csv')).map((r) => ({
    time: ts(r.hour),
    value: r.value,
    source: SOURCE,
  }));
  const priceRows = hourly(path.join(dataDir, 'price.csv'));

  await insertDemand(demandRows);
  await insertSolar(solarRows);
  await insertPrice(priceRows);
  console.log(
    `[seed:dev] ${demandRows.length} tüketim, ${solarRows.length} güneş, ${priceRows.length} tarife satırı yüklendi (gün: ${DATE}, kaynak: ${SOURCE}).`
  );
}

async function main() {
  const [command, fileArg, ...rest] = process.argv.slice(2);
  const sourceFlag = rest.indexOf('--source');
  const source = sourceFlag >= 0 ? rest[sourceFlag + 1] : undefined;

  await initDatabase();

  switch (command) {
    case 'seed-dev': {
      const dir = fileArg ?? path.resolve(__dirname, '../../src/main/resources/data');
      await seedDev(dir);
      break;
    }
    case 'demand': {
      const rows = parseDemandFile(requireFile(fileArg), source ?? 'bdg2');
      await insertDemand(rows);
      console.log(`[import] ${rows.length} bina tüketim satırı aktarıldı.`);
      break;
    }
    case 'solar': {
      const rows = parseSolarFile(requireFile(fileArg), source ?? 'nsrdb');
      await insertSolar(rows);
      console.log(`[import] ${rows.length} güneş üretim satırı aktarıldı.`);
      break;
    }
    case 'price': {
      const rows = parsePriceFile(requireFile(fileArg));
      await insertPrice(rows);
      console.log(`[import] ${rows.length} tarife satırı aktarıldı.`);
      break;
    }
    default:
      console.log('Kullanım: seed-dev [dizin] | demand <csv> [--source x] | solar <csv> [--source x] | price <csv>');
      process.exitCode = 1;
  }
}

function requireFile(file?: string): string {
  if (!file) throw new Error('CSV dosya yolu gerekli.');
  return path.resolve(file);
}

main()
  .catch((err) => {
    console.error('[import] Hata:', err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => dbPool.end());
