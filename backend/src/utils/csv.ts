/**
 * Bağımlılıksız CSV yardımcıları (başlık satırlı; tırnaklı hücreleri ve "" kaçışını destekler;
 * hücre içinde satır sonu desteklenmez — BDG2/NSRDB/tarife dosyaları için yeterlidir).
 */

/** Tek bir CSV satırını hücrelere ayırır. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

export function parseCsv(content: string): Record<string, string>[] {
  const lines = content
    .replace(/^﻿/, '') // BOM
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line, idx) => {
    const cells = splitCsvLine(line);
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
