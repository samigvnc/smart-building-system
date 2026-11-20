/**
 * BDG2/NSRDB ham verisinden Core Engine'in okuduğu hazır profilleri üretir.
 *
 *   npm run profiles:suggest -- --site Fox   -> her bina tipi için aday BDG2 binalarını listeler
 *   npm run profiles:build                    -> config/building-profile-mapping.json'a göre profilleri yazar
 *
 * Hangi BDG2 binasının hangi bina tipine karşılık geleceğini Core Engine tarafı seçer
 * (mapping dosyasındaki bdg2BuildingId). Backend yalnızca seçilen veriyi kopyalar/ölçekler.
 */
import fs from 'node:fs';
import path from 'node:path';
import { dbPool, initDatabase } from '../src/config/database';
import { BuildingType } from '../src/types/energy.types';

const MAPPING_FILE = path.join(__dirname, '..', 'config', 'building-profile-mapping.json');

// Aday arama için BDG2 kullanım türü ipuçları (yalnızca ÖNERİ; seçim Core Engine ekibinindir)
const CANDIDATE_FILTERS: Record<BuildingType, string> = {
  [BuildingType.DORMITORY]: `(sub_primary_space_usage ILIKE '%dorm%' OR sub_primary_space_usage ILIKE '%residence hall%')`,
  [BuildingType.LIBRARY]: `sub_primary_space_usage ILIKE '%library%'`,
  [BuildingType.LABORATORY]: `sub_primary_space_usage ILIKE '%laborator%'`,
  [BuildingType.CAFETERIA]: `(sub_primary_space_usage ILIKE '%restaurant%' OR sub_primary_space_usage ILIKE '%dining%' OR sub_primary_space_usage ILIKE '%cafeteria%' OR primary_space_usage ILIKE 'food%')`,
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function suggest(site: string) {
  console.log(`\n=== ${site} sahası için aday binalar (ölçüm sayısı = veri doluluğu) ===`);
  for (const type of Object.values(BuildingType)) {
    const res = await dbPool.query(
      `SELECT b.building_id, b.sub_primary_space_usage AS usage, b.sqm,
              COUNT(r.kwh) AS readings, ROUND(AVG(r.kwh)::numeric, 1) AS avg_kwh
         FROM bdg2_buildings b
         JOIN bdg2_electricity_readings r ON r.building_id = b.building_id
        WHERE b.site_id = $1 AND ${CANDIDATE_FILTERS[type]}
        GROUP BY b.building_id, b.sub_primary_space_usage, b.sqm
        ORDER BY readings DESC, b.building_id
        LIMIT 8`,
      [site]
    );
    console.log(`\n${type}:`);
    if (res.rows.length === 0) console.log('  (aday yok — bu sahada elektrik verisi aktarıldı mı?)');
    for (const r of res.rows) {
      console.log(
        `  ${r.building_id.padEnd(32)} ${String(r.usage).padEnd(22)} ${String(Math.round(r.sqm ?? 0)).padStart(7)} m²  ` +
          `${String(r.readings).padStart(6)} ölçüm  ort ${r.avg_kwh} kWh`
      );
    }
  }
}

async function build() {
  const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));
  const set: string = mapping.profileSet;
  if (!set) throw new Error('mapping.profileSet gerekli.');

  let demandRows = 0;
  for (const type of Object.values(BuildingType)) {
    const m = mapping.demand?.[type];
    if (!m?.bdg2BuildingId) {
      console.warn(`[profiles] ${type}: bdg2BuildingId seçilmemiş, atlandı.`);
      continue;
    }
    const scale = Number(m.scale ?? 1);
    if (!(scale > 0)) throw new Error(`${type}: scale pozitif olmalı.`);
    const res = await dbPool.query(
      `INSERT INTO building_demand_readings (time, building_type, demand_kwh, source)
       SELECT time, $1, kwh * $2, $3 FROM bdg2_electricity_readings WHERE building_id = $4
       ON CONFLICT (time, building_type, source) DO UPDATE SET demand_kwh = EXCLUDED.demand_kwh`,
      [type, scale, set, m.bdg2BuildingId]
    );
    if (res.rowCount === 0) throw new Error(`${type}: "${m.bdg2BuildingId}" için ham veri yok (bdg2:import --sites ...).`);
    console.log(`[profiles] ${type} <- ${m.bdg2BuildingId} (x${scale}): ${res.rowCount} saatlik satır`);
    demandRows += res.rowCount ?? 0;
  }

  const solar = mapping.solar;
  if (solar?.siteId) {
    const kwp = Number(solar.capacityKwp);
    const pr = Number(solar.performanceRatio);
    if (!(kwp > 0) || !(pr > 0 && pr <= 1)) throw new Error('solar.capacityKwp > 0 ve 0 < performanceRatio <= 1 olmalı.');
    const res = await dbPool.query(
      `INSERT INTO solar_readings (time, generation_kwh, source)
       SELECT time, ghi_wm2 / 1000.0 * $1 * $2, $3 FROM nsrdb_ghi_readings WHERE site_id = $4
       ON CONFLICT (time, source) DO UPDATE SET generation_kwh = EXCLUDED.generation_kwh`,
      [kwp, pr, set, solar.siteId]
    );
    if (res.rowCount === 0) console.warn(`[profiles] Güneş: "${solar.siteId}" için NSRDB verisi yok (npm run nsrdb:fetch).`);
    else console.log(`[profiles] Güneş <- NSRDB ${solar.siteId} (${kwp} kWp, PR ${pr}): ${res.rowCount} saatlik satır`);
  }

  console.log(`[profiles] Profil seti "${set}" hazır (${demandRows} talep satırı). API: source=${set}`);
}

async function main() {
  await initDatabase();
  const command = process.argv[2];
  if (command === 'suggest') await suggest(arg('site') ?? 'Fox');
  else if (command === 'build') await build();
  else {
    console.log('Kullanım: suggest [--site Fox] | build');
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('[profiles] Hata:', err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => dbPool.end());
