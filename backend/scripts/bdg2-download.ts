/**
 * BDG2 ham dosyalarını GitHub'dan (Git LFS) indirir ve bütünlüğünü doğrular.
 *   npm run bdg2:download
 *
 * Kaynak: https://github.com/buds-lab/building-data-genome-project-2  (Miller et al., 2020, Scientific Data)
 * Hedef:  backend/data/raw/bdg2/  (git'e EKLENMEZ; .gitignore'dadır)
 *  - metadata.csv                 (~0.3 MB)  bina üstverisi
 *  - electricity_cleaned.csv      (~175 MB)  saatlik elektrik tüketimi (2016-2017)
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const REPO = 'buds-lab/building-data-genome-project-2';
const BRANCH = 'master';

const FILES = [
  { repoPath: 'data/metadata/metadata.csv', name: 'metadata.csv' },
  { repoPath: 'data/meters/cleaned/electricity_cleaned.csv', name: 'electricity_cleaned.csv' },
];

/** Git LFS işaretçisinden (raw.githubusercontent) gerçek dosyanın SHA-256 ve boyutunu okur. */
async function lfsPointer(repoPath: string): Promise<{ oid: string; size: number }> {
  const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${repoPath}`);
  if (!res.ok) throw new Error(`LFS işaretçisi okunamadı (${res.status}): ${repoPath}`);
  const text = await res.text();
  const oid = /oid sha256:([0-9a-f]{64})/.exec(text)?.[1];
  const size = Number(/size (\d+)/.exec(text)?.[1]);
  if (!oid || !size) throw new Error(`Beklenmeyen LFS işaretçisi: ${repoPath}`);
  return { oid, size };
}

async function sha256(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest('hex');
}

async function main() {
  const dir = path.join(__dirname, '..', 'data', 'raw', 'bdg2');
  fs.mkdirSync(dir, { recursive: true });

  for (const f of FILES) {
    const target = path.join(dir, f.name);
    const { oid, size } = await lfsPointer(f.repoPath);

    if (fs.existsSync(target) && fs.statSync(target).size === size && (await sha256(target)) === oid) {
      console.log(`[bdg2:download] ${f.name} zaten indirilmiş ve doğrulanmış.`);
      continue;
    }

    console.log(`[bdg2:download] ${f.name} indiriliyor (${(size / 1e6).toFixed(1)} MB)...`);
    const res = await fetch(`https://media.githubusercontent.com/media/${REPO}/${BRANCH}/${f.repoPath}`);
    if (!res.ok || !res.body) throw new Error(`İndirme başarısız (${res.status}): ${f.name}`);

    const tmp = `${target}.part`;
    await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(tmp));

    if ((await sha256(tmp)) !== oid) {
      fs.rmSync(tmp, { force: true });
      throw new Error(`SHA-256 uyuşmuyor, dosya silindi: ${f.name}`);
    }
    fs.renameSync(tmp, target);
    console.log(`[bdg2:download] ${f.name} indirildi ve SHA-256 doğrulandı.`);
  }
}

main().catch((err) => {
  console.error('[bdg2:download] Hata:', err.message ?? err);
  process.exitCode = 1;
});
