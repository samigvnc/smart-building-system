/**
 * BDG2 (Building Data Genome Project 2) ham verisini veritabanına aktarır.
 *
 *   npm run bdg2:import                         -> metadata (tüm binalar) + elektrik (Fox, Hog sahaları)
 *   npm run bdg2:import -- --sites Fox,Bull     -> belirtilen sahaların elektrik verisi
 *   npm run bdg2:import -- --sites all          -> tüm sahalar (~22 milyon satır, uzun sürer)
 *   npm run bdg2:import -- --dir <klasör>       -> varsayılan: data/raw/bdg2
 *
 * Ham veri DEĞİŞTİRİLMEZ; bina profili seçimi/ölçekleme ayrı adımdır (npm run profiles:build).
 * İndirme: npm run bdg2:download
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { dbPool, initDatabase } from '../src/config/database';
import { parseCsv, splitCsvLine } from '../src/utils/csv';

const BATCH = 20000;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const num = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function importMetadata(dir: string): Promise<Map<string, string>> {
  const file = path.join(dir, 'metadata.csv');
  if (!fs.existsSync(file)) throw new Error(`Bulunamadı: ${file} (önce npm run bdg2:download)`);
  const rows = parseCsv(fs.readFileSync(file, 'utf-8'));

  const siteOf = new Map<string, string>();
  for (const r of rows) siteOf.set(r['building_id'], r['site_id']);

  const col = (key: string) => rows.map((r) => r[key] ?? '');
  await dbPool.query(
    `INSERT INTO bdg2_buildings
       (building_id, site_id, primary_space_usage, sub_primary_space_usage, sqm, lat, lng, timezone,
        year_built, occupants, has_electricity)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::float8[], $6::float8[],
                          $7::float8[], $8::text[], $9::int[], $10::int[], $11::bool[])
     ON CONFLICT (building_id) DO UPDATE SET
       site_id = EXCLUDED.site_id, primary_space_usage = EXCLUDED.primary_space_usage,
       sub_primary_space_usage = EXCLUDED.sub_primary_space_usage, sqm = EXCLUDED.sqm, lat = EXCLUDED.lat,
       lng = EXCLUDED.lng, timezone = EXCLUDED.timezone, year_built = EXCLUDED.year_built,
       occupants = EXCLUDED.occupants, has_electricity = EXCLUDED.has_electricity`,
    [
      col('building_id'),
      col('site_id'),
      col('primaryspaceusage'),
      col('sub_primaryspaceusage'),
      rows.map((r) => num(r['sqm'])),
      rows.map((r) => num(r['lat'])),
      rows.map((r) => num(r['lng'])),
      col('timezone'),
      rows.map((r) => {
        const n = num(r['yearbuilt']);
        return n === null ? null : Math.round(n);
      }),
      rows.map((r) => {
        const n = num(r['occupants']);
        return n === null ? null : Math.round(n);
      }),
      rows.map((r) => (r['electricity'] ?? '').toLowerCase() === 'yes'),
    ]
  );
  console.log(`[bdg2] ${rows.length} bina üstverisi aktarıldı.`);
  return siteOf;
}

async function flush(buf: { t: string[]; b: string[]; v: number[] }) {
  if (buf.t.length === 0) return;
  await dbPool.query(
    `INSERT INTO bdg2_electricity_readings (time, building_id, kwh)
     SELECT * FROM unnest($1::timestamptz[], $2::text[], $3::float8[])
     ON CONFLICT (building_id, time) DO UPDATE SET kwh = EXCLUDED.kwh`,
    [buf.t, buf.b, buf.v]
  );
  buf.t.length = buf.b.length = buf.v.length = 0;
}

async function importElectricity(dir: string, siteOf: Map<string, string>, sites: Set<string> | 'all') {
  const file = path.join(dir, 'electricity_cleaned.csv');
  if (!fs.existsSync(file)) throw new Error(`Bulunamadı: ${file} (önce npm run bdg2:download)`);

  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf-8' }), crlfDelay: Infinity });
  let selected: { idx: number; id: string }[] = [];
  const buf = { t: [] as string[], b: [] as string[], v: [] as number[] };
  let lineNo = 0;
  let inserted = 0;
  let skippedNegative = 0;

  for await (const line of rl) {
    lineNo++;
    if (lineNo === 1) {
      const header = splitCsvLine(line);
      selected = header
        .map((id, idx) => ({ id, idx }))
        .filter(({ id, idx }) => idx > 0 && siteOf.has(id) && (sites === 'all' || sites.has(siteOf.get(id)!)));
      if (selected.length === 0) throw new Error('Seçilen sahalarda elektrik sütunu bulunamadı.');
      console.log(`[bdg2] ${selected.length} bina için elektrik verisi okunuyor...`);
      continue;
    }
    if (!line.trim()) continue;

    const cells = line.split(','); // elektrik dosyasında tırnaklı hücre yok
    // BDG2 saatleri yerel duvar saatidir; değiştirmeden UTC etiketiyle saklanır (bkz. database.ts)
    const time = `${cells[0].trim().replace(' ', 'T')}.000Z`;

    for (const { idx, id } of selected) {
      const raw = cells[idx];
      if (raw === undefined || raw === '') continue; // eksik ölçüm
      const v = Number(raw);
      if (!Number.isFinite(v)) continue;
      if (v < 0) {
        skippedNegative++;
        continue;
      }
      buf.t.push(time);
      buf.b.push(id);
      buf.v.push(v);
      if (buf.t.length >= BATCH) {
        inserted += buf.t.length;
        await flush(buf);
        if (inserted % (BATCH * 25) === 0) console.log(`[bdg2]   ${inserted.toLocaleString('tr-TR')} satır...`);
      }
    }
  }
  inserted += buf.t.length;
  await flush(buf);
  console.log(
    `[bdg2] ${inserted.toLocaleString('tr-TR')} elektrik ölçümü aktarıldı` +
      (skippedNegative ? ` (${skippedNegative} negatif değer atlandı).` : '.')
  );
}

async function main() {
  const dir = path.resolve(arg('dir') ?? path.join(__dirname, '..', 'data', 'raw', 'bdg2'));
  const sitesArg = arg('sites') ?? 'Fox,Hog';
  const sites: Set<string> | 'all' =
    sitesArg.toLowerCase() === 'all' ? 'all' : new Set(sitesArg.split(',').map((s) => s.trim()).filter(Boolean));

  await initDatabase();
  const siteOf = await importMetadata(dir);
  await importElectricity(dir, siteOf, sites);
}

main()
  .catch((err) => {
    console.error('[bdg2] Hata:', err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => dbPool.end());
