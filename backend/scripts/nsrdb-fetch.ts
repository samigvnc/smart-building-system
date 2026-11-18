/**
 * NSRDB'den (NLR/NREL) saatlik GHI verisini API ile çekip veritabanına yazar.
 *
 *   npm run nsrdb:fetch -- --site Fox --years 2016,2017
 *
 * Gereken ortam değişkenleri (.env): NSRDB_API_KEY, NSRDB_EMAIL  (https://developer.nlr.gov/signup/)
 * İsteğe bağlı: NSRDB_FULL_NAME, NSRDB_AFFILIATION.
 * Konum, BDG2 üstverisindeki sahanın (site) bina koordinatlarının ortalamasıdır; önce `bdg2:import` çalışmalıdır.
 * Zaman damgaları yerel STANDART saattir (utc=false); BDG2 ile aynı yerel duvar saati mantığıyla saklanır.
 * Simülasyon yalnızca bu DB'den okur; dış API'ye bağımlı değildir.
 */
import { ENV } from '../src/config/env';
import { dbPool, initDatabase } from '../src/config/database';
import { parseNsrdbCsv } from '../src/utils/nsrdb';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function fetchYear(lat: number, lng: number, year: number): Promise<string> {
  const { API_KEY, EMAIL, FULL_NAME, AFFILIATION, BASE_URL, ENDPOINT } = ENV.NSRDB;
  // WKT: boylam önce, 4 ondalık, tek boşluk
  const params = new URLSearchParams({
    api_key: API_KEY,
    full_name: FULL_NAME,
    email: EMAIL,
    affiliation: AFFILIATION,
    reason: 'research',
    mailing_list: 'false',
    wkt: `POINT(${lng.toFixed(4)} ${lat.toFixed(4)})`,
    names: String(year),
    attributes: 'ghi',
    leap_day: 'true',
    utc: 'false',
    interval: '60',
  });

  const res = await fetch(`${BASE_URL}${ENDPOINT}?${params.toString()}`);
  if (!res.ok) {
    const body = (await res.text()).slice(0, 500);
    throw new Error(`NSRDB isteği başarısız (HTTP ${res.status}): ${body.replace(API_KEY, '***')}`);
  }
  return res.text();
}

/** Geçici ağ hatalarında (ve hız sınırında) artan bekleme ile 4 kez dener. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts) {
        const waitMs = 3000 * i;
        console.warn(`[nsrdb] Deneme ${i}/${attempts} başarısız, ${waitMs / 1000} sn sonra tekrar...`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }
  throw lastError;
}

async function main() {
  const site = arg('site');
  const years = (arg('years') ?? '2016,2017').split(',').map((y) => Number(y.trim()));
  if (!site) throw new Error('--site gerekli (örn. --site Fox).');
  if (years.some((y) => !Number.isInteger(y))) throw new Error('--years geçersiz (örn. 2016,2017).');
  if (!ENV.NSRDB.API_KEY || !ENV.NSRDB.EMAIL) {
    throw new Error('NSRDB_API_KEY ve NSRDB_EMAIL .env dosyasında tanımlı olmalı (https://developer.nlr.gov/signup/).');
  }

  await initDatabase();
  const loc = await dbPool.query(
    `SELECT AVG(lat) AS lat, AVG(lng) AS lng FROM bdg2_buildings
      WHERE site_id = $1 AND lat IS NOT NULL AND lng IS NOT NULL`,
    [site]
  );
  const { lat, lng } = loc.rows[0];
  if (lat === null) throw new Error(`"${site}" sahası için koordinat bulunamadı (önce npm run bdg2:import).`);
  console.log(`[nsrdb] ${site}: enlem ${Number(lat).toFixed(4)}, boylam ${Number(lng).toFixed(4)}`);

  for (const year of years) {
    const rows = parseNsrdbCsv(await withRetry(() => fetchYear(Number(lat), Number(lng), year)));
    for (let i = 0; i < rows.length; i += 5000) {
      const c = rows.slice(i, i + 5000);
      await dbPool.query(
        `INSERT INTO nsrdb_ghi_readings (site_id, time, ghi_wm2)
         SELECT $1, * FROM unnest($2::timestamptz[], $3::float8[])
         ON CONFLICT (site_id, time) DO UPDATE SET ghi_wm2 = EXCLUDED.ghi_wm2`,
        [site, c.map((r) => r.time), c.map((r) => r.ghi)]
      );
    }
    console.log(`[nsrdb] ${year}: ${rows.length} saatlik GHI satırı aktarıldı.`);
  }
}

main()
  .catch((err) => {
    console.error('[nsrdb] Hata:', err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => dbPool.end());
