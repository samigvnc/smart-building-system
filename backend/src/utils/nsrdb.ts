import { splitCsvLine } from './csv';

export interface GhiReading {
  /** Yerel standart saat duvar saati, ISO biçiminde ve "Z" etiketli (bkz. database.ts zaman damgası notu). */
  time: string;
  ghi: number; // W/m²
}

/**
 * NSRDB (PSM) CSV yanıtını okur. Yanıt: üstte 2 satır konum üstverisi, sonra
 * "Year,Month,Day,Hour,Minute,GHI,..." başlığı ve saatlik/yarım saatlik satırlar.
 * Saat içi dakika (ör. :30) yok sayılır; satırlar saate yuvarlanır (aşağı).
 * Aynı saate düşen birden çok satırın (30 dk aralık) GHI ortalaması alınır.
 */
export function parseNsrdbCsv(content: string): GhiReading[] {
  const lines = content.replace(/^﻿/, '').split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => /^year\s*,/i.test(l.trim()));
  if (headerIdx < 0) throw new Error('NSRDB yanıtında "Year,Month,Day,Hour,Minute,GHI" başlığı bulunamadı.');

  const header = splitCsvLine(lines[headerIdx]).map((h) => h.toLowerCase());
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`NSRDB yanıtında "${name}" sütunu yok (attributes=ghi istenmeli).`);
    return i;
  };
  const [iY, iM, iD, iH, iGhi] = [col('year'), col('month'), col('day'), col('hour'), col('ghi')];

  const sums = new Map<string, { sum: number; n: number }>();
  for (const line of lines.slice(headerIdx + 1)) {
    if (!line.trim()) continue;
    const c = splitCsvLine(line);
    const ghi = Number(c[iGhi]);
    if (!Number.isFinite(ghi)) throw new Error(`NSRDB satırında geçersiz GHI: "${c[iGhi]}"`);
    const pad = (v: string) => String(Number(v)).padStart(2, '0');
    const key = `${c[iY]}-${pad(c[iM])}-${pad(c[iD])}T${pad(c[iH])}:00:00.000Z`;
    const acc = sums.get(key) ?? { sum: 0, n: 0 };
    acc.sum += Math.max(0, ghi); // negatif/gece gürültüsünü sıfırla
    acc.n += 1;
    sums.set(key, acc);
  }

  return [...sums.entries()].map(([time, a]) => ({ time, ghi: a.sum / a.n }));
}

/** GHI (W/m²) -> saatlik üretim (kWh): kWp × GHI/1000 × performans oranı. */
export function ghiToGenerationKwh(ghiWm2: number, capacityKwp: number, performanceRatio: number): number {
  return (ghiWm2 / 1000) * capacityKwp * performanceRatio;
}
