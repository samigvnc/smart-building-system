# Smart Building System - Ana Backend

Bu proje; yapay zeka destekli, çok binalı akıllı kampüs/bina enerji yönetim ve simülasyon sisteminin **Ana Backend** katmanıdır.

---

## 🏛️ Mimari ve Servisler Arası İletişim

```
[ Canlı Sensör Verisi ] (Node.js / Socket.io)
           │
           ▼ (RabbitMQ: sensor_data_queue)
┌─────────────────────────────────────────────────────────┐
│              ANA BACKEND (Node.js / Express TS)         │
│  - Canlı karar akışı (sensör -> strateji -> DB/yayın)   │
│  - TimescaleDB: metrikler + BDG2/NSRDB/tarife verisi    │
│  - Simülasyon API'si: veri hazırlar, Core Engine'i      │
│    çağırır, sonucu saklar                               │
└─────────────────────────────────────────────────────────┘
      │ (RabbitMQ RPC: core_engine_queue)      │ (REST API)
      ▼                                        ▼
[ Core Engine / Simülasyon Motoru ]     [ Frontend Arayüzü ]
(Java: Basic/Smart, senaryo, metrik)    (React.js + Chart.js)
```

**Tek simülasyon mantığı Core Engine'dedir.** Backend istek/veri/DB/API tarafını yönetir. Ayrıntılı
sözleşme: [docs/core-engine-contract.md](docs/core-engine-contract.md).

---

## ⚡ Ortak Varsayılanlar (Backend ↔ Core Engine)

| Ayar | Varsayılan | `.env` |
|---|---|---|
| Kritik binalar | `LABORATORY` (yapılandırılabilir) | `CRITICAL_BUILDINGS` |
| Min. batarya rezervi | `%25` | `BATTERY_MIN_RESERVE_PERCENT` |
| Yüksek fiyat eşiği | `2.5` | `SIMULATION_HIGH_PRICE_THRESHOLD` |
| Kesinti ön bakış | `3` saat | `SIMULATION_OUTAGE_LOOKAHEAD_HOURS` |

Bina tipleri: `LABORATORY`, `LIBRARY`, `DORMITORY`, `CAFETERIA`.

Canlı sensör akışındaki karar motoru (`EnergyStrategyService`) aynı kritik bina ve rezerv ayarlarını kullanır:
kritik binalar önce beslenir, kritik olmayanlar kesilir (load shedding).

---

## 📡 API Uç Noktaları ve Test

`api-requests.http` dosyası hazır istekleri içerir (VS Code REST Client ile).

| Metot | Uç Nokta | Açıklama |
|---|---|---|
| `GET` | `/api/health` | Sistem sağlık kontrolü |
| `GET` | `/api/simulation/defaults` | Ortak varsayılanlar (Frontend formu için) |
| `GET` | `/api/simulation/inputs` | DB'den hazırlanan 24 saatlik Core Engine girdisi (önizleme) |
| `POST` | `/api/simulation/run` | Core Engine'de Basic vs Smart simülasyonu çalıştırır, sonucu saklar |
| `GET` | `/api/simulation/runs`, `/runs/:id` | Geçmiş simülasyon çalıştırmaları |
| `POST` | `/api/energy/simulate-step` | Tekil adım için canlı karar motoru (Basic/Smart) |
| `GET` | `/api/energy/metrics` | Ham zaman serisi verileri |
| `GET` | `/api/energy/metrics/aggregated` | `time_bucket()` ile özetlenmiş veri |

> `POST /api/energy/run-scenario` kaldırıldı; yerine `POST /api/simulation/run` kullanılır.
> Core Engine çalışmıyorsa `/run` isteği `504` (yanıt yok) veya `503` (broker yok) döner.

---

## 🗄️ Simülasyon Verisi (BDG2 / NSRDB / tarife)

```bash
npm run seed:dev                                   # Core Engine'in dev CSV'lerini DB'ye yükler
npm run import:data -- demand bdg2_long.csv        # timestamp,building_type,demand_kwh
npm run import:data -- solar  nsrdb.csv            # timestamp,generation_kwh
npm run import:data -- price  tariff.csv           # hour,price_per_kwh
```

Zaman damgaları ISO-8601 (saat dilimi yoksa UTC). Gerçek BDG2 dosyası geniş biçimde (sütun = bina) gelir;
`building_type` eşlemesiyle uzun biçime dönüştüren araç dosya paylaşılınca eklenecek.

---

## 🧪 Birim Testleri (Unit Tests)

Karar algoritmalarımızın (Basic & Smart Strategy) matematiksel doğruluğunu test etmek için:

```bash
npm test
```
*(Node.js yerleşik test motoru ile `tests/` altındaki tüm testleri çalıştırır).*

---

## 🚀 Başlangıç & Kurulum Adımları

### 1. Bağımlılıkları Yükleyin:
```bash
npm install
```

### 2. Çevre Değişkenlerini Ayarlayın:
`.env.example` dosyasını `.env` olarak kopyalayın:
```bash
cp .env.example .env
```

### 3. Geliştirme Modunda Çalıştırın:
```bash
npm run dev
```

### 4. Git İle GitHub'a Gönderme:
```bash
git add .
git commit -m "feat: complete initial backend architecture with TimescaleDB, RabbitMQ, and strategy engine"
git push origin main
```
