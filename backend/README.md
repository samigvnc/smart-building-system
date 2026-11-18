# Smart Building System - Ana Backend

Bu katman **yalnızca iki iş** yapar: **veri yönetimi (DB)** ve **API ile haberleşme**.
Enerji stratejileri, senaryo uygulaması ve metrik hesapları **Core Engine'de (Java)** yapılır; backend karar vermez.

---

## 🏛️ Mimari

```
BDG2 ham veri ─► backend ön işleme ─► TimescaleDB ─► backend API ─► SimulationInputProvider ─► Simülasyon Motoru (Java)
NSRDB (API)  ─►                                                                                        │
                                                                                                        ▼
[ Frontend ] ◄──────────── REST API (/api/simulation/*) ◄────────── backend ◄──── StrategyComparisonResult
```

| Backend'in işi | Core Engine'in işi |
|---|---|
| BDG2 ve NSRDB verisini indirmek, DB'ye yazmak | Bina profillerini (hangi BDG2 binası) seçmek |
| Core Engine'in okuyacağı 24 saatlik girdiyi hazırlamak | Basic/Smart strateji, senaryo, metrik |
| İsteği Core Engine'e iletmek, sonucu saklamak | Simülasyon sonucunu üretmek |
| Frontend için REST API | Dış API'ye bağlanmamak (veri backend'den gelir) |

Ayrıntılı sözleşme: [docs/core-engine-contract.md](docs/core-engine-contract.md).

---

## 🗄️ Veri: BDG2 + NSRDB

Veri kaynakları:
- **BDG2** ([Building Data Genome Project 2](https://github.com/buds-lab/building-data-genome-project-2), Miller vd. 2020, *Scientific Data*): saatlik elektrik tüketimi + bina üstverisi (2016-2017). Lisans/atıf koşulları için deponun sayfasına bakın.
- **NSRDB** ([NLR/NREL](https://developer.nlr.gov/docs/solar/nsrdb/)): saatlik güneş ışınımı (GHI), API ile çekilir.

Ham dosyalar `backend/data/raw/` altına iner ve **git'e eklenmez** (~175 MB).

```bash
npm run bdg2:download                    # metadata.csv + electricity_cleaned.csv indirir, SHA-256 doğrular
npm run bdg2:import                      # metadata (1636 bina) + elektrik (varsayılan saha: Fox, Hog) -> DB
npm run bdg2:import -- --sites Fox,Bull  # başka sahalar;  --sites all  -> hepsi (~22 milyon satır)

npm run nsrdb:fetch -- --site Fox --years 2016,2017   # NSRDB_API_KEY ve NSRDB_EMAIL gerekir (.env)

npm run profiles:suggest -- --site Fox   # bina tipi başına aday BDG2 binalarını listeler
npm run profiles:build                   # config/building-profile-mapping.json'a göre hazır profilleri yazar

npm run seed:dev                         # Core Engine'in geliştirme CSV'leri + tarife (source=dev)
```

**Tablolar:** ham → `bdg2_buildings`, `bdg2_electricity_readings`, `nsrdb_ghi_readings`;
hazır profiller → `building_demand_readings`, `solar_readings` (`source` = profil seti adı, örn. `real`, `dev`);
`grid_price_profile` (tarife), `simulation_runs` (Core Engine istek/sonuç kaydı), `sensor_telemetry` (ham sensör verisi).

**Zaman damgaları:** BDG2 ve NSRDB saatleri *saha yerel saati* olarak, değiştirilmeden saklanır (UTC etiketli).
"Günün 0-23. saati" bu yüzden yerel saat anlamına gelir. NSRDB `utc=false` ile yerel *standart* saat verir;
yaz saati uygulayan sahalarda BDG2 ile 1 saatlik fark olabilir (Fox/Arizona yaz saati uygulamaz).

**Bina profili seçimi** `config/building-profile-mapping.json` dosyasındadır ve **Core Engine ekibine aittir**
(hangi BDG2 binası → DORMITORY/LIBRARY/LABORATORY/CAFETERIA, ölçek çarpanı, güneş kurulu gücü).

---

## ⚙️ Ortak Varsayılanlar (Backend ↔ Core Engine)

| Ayar | Varsayılan | `.env` |
|---|---|---|
| Kritik binalar | `LABORATORY` (yapılandırılabilir) | `CRITICAL_BUILDINGS` |
| Min. batarya rezervi | `%25` | `BATTERY_MIN_RESERVE_PERCENT` |
| Yüksek fiyat eşiği | `2.5` | `SIMULATION_HIGH_PRICE_THRESHOLD` |
| Kesinti ön bakış | `3` saat | `SIMULATION_OUTAGE_LOOKAHEAD_HOURS` |

Bina tipleri: `LABORATORY`, `LIBRARY`, `DORMITORY`, `CAFETERIA`. Bunlar yalnızca istekle Core Engine'e iletilir.

---

## 📡 API Uç Noktaları

`api-requests.http` dosyası hazır istekleri içerir (VS Code REST Client ile).

| Metot | Uç Nokta | Açıklama |
|---|---|---|
| `GET` | `/api/health` | Sistem sağlık kontrolü |
| `GET` | `/api/simulation/defaults` | Ortak varsayılanlar (Frontend formu için) |
| `GET` | `/api/simulation/data-summary` | Hazır profil setleri, tarih aralıkları, bina tipleri |
| `GET` | `/api/simulation/inputs` | DB'den hazırlanan 24 saatlik Core Engine girdisi (önizleme) |
| `POST` | `/api/simulation/run` | Girdiyi Core Engine'e gönderir, sonucu saklar ve döner |
| `GET` | `/api/simulation/runs`, `/runs/:id` | Geçmiş simülasyon çalıştırmaları |

Core Engine çalışmıyorsa `/run` isteği `504` (yanıt yok) veya `503` (broker yok) döner.

**Sensör akışı:** `sensor_data_queue`'ya gelen telemetri doğrulanıp `sensor_telemetry` tablosuna yazılır.
Bozuk mesajlar `dead_letter_queue`'ya taşınır. Backend bu veriden karar üretmez.

---

## 🧪 Testler

```bash
npm test
```

---

## 🚀 Başlangıç

```bash
npm install
cp .env.example .env
docker compose up -d        # TimescaleDB + RabbitMQ
npm run dev
```
