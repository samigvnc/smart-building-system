/**
 * Basit, bağımlılıksız CSV okuyucu (başlık satırlı, tırnaksız hücreler).
 * İçe aktarılan veri setleri (BDG2 çıktısı, NSRDB, tarife) için yeterlidir.
 */
export function parseCsv(content: string): Record<string, string>[] {
  const lines = content
    .replace(/^﻿/, '') // BOM
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line, idx) => {
    const cells = line.split(',').map((c) => c.trim());
    if (cells.length !== header.length) {
      throw new Error(`CSV satır ${idx + 2}: ${header.length} sütun bekleniyordu, ${cells.length} bulundu.`);
    }
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i]));
    return row;
  });
}

export function toNonNegativeNumber(value: string, label: string): number {
  const n = Number(value);
  if (value === '' || !Number.isFinite(n) || n < 0) {
    throw new Error(`${label} geçersiz veya negatif: "${value}"`);
  }
  return n;
}
