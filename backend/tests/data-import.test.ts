import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseCsv, splitCsvLine } from '../src/utils/csv';
import { ghiToGenerationKwh, parseNsrdbCsv } from '../src/utils/nsrdb';

describe('CSV okuyucu (BDG2 metadata biçimi)', () => {
  it('Tırnaklı ve virgül içeren hücreleri doğru ayırır', () => {
    assert.deepStrictEqual(splitCsvLine('Panther_x,Public services,"Community Center, Community Centers",12.5'), [
      'Panther_x',
      'Public services',
      'Community Center, Community Centers',
      '12.5',
    ]);
    assert.deepStrictEqual(splitCsvLine('a,"say ""merhaba""",c'), ['a', 'say "merhaba"', 'c']);
    assert.deepStrictEqual(splitCsvLine('a,,c'), ['a', '', 'c']);
  });

  it('Başlıklı dosyayı okur, sütun sayısı uyuşmayan satırı reddeder', () => {
    const rows = parseCsv('building_id,sub\r\nFox_a,"Library, Annex"\r\n');
    assert.deepStrictEqual(rows, [{ building_id: 'Fox_a', sub: 'Library, Annex' }]);
    assert.throws(() => parseCsv('a,b\n1'));
  });
});

describe('NSRDB CSV ayrıştırıcı', () => {
  // NSRDB yanıtı: 2 üstveri satırı + başlık + veri
  const sample = [
    'Source,Location ID,City,State,Country,Latitude,Longitude,Time Zone,Elevation,Local Time Zone,Version',
    'NSRDB,123,-,-,-,33.42,-111.93,-7,350,-7,4.0.0',
    'Year,Month,Day,Hour,Minute,GHI',
    '2017,6,1,0,30,0',
    '2017,6,1,12,30,950.5',
    '2017,6,1,13,30,980',
  ].join('\n');

  it('Saatlik GHI satırlarını yerel duvar saati (Z etiketli) olarak okur', () => {
    const rows = parseNsrdbCsv(sample);
    assert.strictEqual(rows.length, 3);
    assert.deepStrictEqual(rows[1], { time: '2017-06-01T12:00:00.000Z', ghi: 950.5 });
  });

  it('30 dakikalık aralıkta aynı saatin değerlerinin ortalamasını alır, negatifi sıfırlar', () => {
    const half = ['Year,Month,Day,Hour,Minute,GHI', '2017,6,1,12,0,100', '2017,6,1,12,30,300', '2017,6,1,3,0,-5'].join('\n');
    const rows = parseNsrdbCsv(half);
    assert.strictEqual(rows.find((r) => r.time.includes('T12:'))?.ghi, 200);
    assert.strictEqual(rows.find((r) => r.time.includes('T03:'))?.ghi, 0);
  });

  it('Başlık veya GHI sütunu yoksa anlaşılır hata verir', () => {
    assert.throws(() => parseNsrdbCsv('bozuk,veri'), /başlığı bulunamadı/);
    assert.throws(() => parseNsrdbCsv('Year,Month,Day,Hour,Minute,DNI\n2017,1,1,0,0,5'), /ghi/i);
  });

  it('GHI -> kWh dönüşümü: kWp × GHI/1000 × PR', () => {
    assert.strictEqual(ghiToGenerationKwh(1000, 100, 0.8), 80);
    assert.strictEqual(ghiToGenerationKwh(0, 100, 0.8), 0);
  });
});
