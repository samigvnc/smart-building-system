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
│  - EnergyStrategyService (Basic & Smart Algoritmaları)  │
│  - TimescaleDB (Zaman Serisi & Hypertable)              │
│  - Dynamic Pricing & Load Shedding Engine               │
│  - SimulationRunner (24-Saatlik Senaryo Analizi)        │
└─────────────────────────────────────────────────────────┘
           │                                 │
           ▼ (RabbitMQ)                      ▼ (REST API)
[ Core Calculation Engine ]       [ Frontend Arayüzü ]
(Java / Spring Boot)              (React.js + Chart.js)
```

---

## ⚡ Karar Mekanizmaları ve Stratejiler

### 1. Basic Strategy (Sıralı Yaklaşım)
1. Güneş Enerjisi $\ge$ Talep: Binalar beslenir, artan enerji bataryaya şarj edilir.
2. Güneş Enerjisi $<$ Talep: Açık kalan kısım sırasıyla:
   - Bataryadan çekilir (0 kWh'a kadar).
   - Batarya biterse Şebekeden (Grid) çekilir.
   - Şebeke de kesikse karşılanamayan kısım **Unserved Energy** olarak kaydedilir.

### 2. Smart Strategy (Kural ve Öncelik Tabanlı Yaklaşım)
1. **Şebeke Fiyat Arbitrajı:** Elektrik fiyatı ucuzsa (`gridElectricityPrice <= 0.15`), batarya deşarj edilmez ve şebekeden çekim yapılarak batarya "Demand Spike" (pahalı saatler) için saklanır.
2. **Kritik Rezerv Koruması:** Şebeke bağlıyken bataryada daima **minimum %20 rezerv** muhafaza edilir.
3. **Kritik Yük Önceliklendirmesi (Load Shedding):** Şebeke kesintisinde ve enerji yetersizliğinde:
   - **Öncelik 1:** `LABORATORY` (Kritik - en son kesilir)
   - **Öncelik 2:** `LIBRARY` (Kritik)
   - **Yük Atma:** `DORMITORY` (Enerjisi ilk kesilen yük)

---

## 📡 API Uç Noktaları ve Test

Projede hazır istek senaryoları barındıran `api-requests.http` dosyası bulunmaktadır (VS Code REST Client eklentisi ile tek tıkla test edilebilir).

| Metot | Uç Nokta | Açıklama |
|---|---|---|
| `GET` | `/api/health` | Sistem sağlık ve çalışma süresi kontrolü |
| `POST` | `/api/energy/simulate-step` | Tekil zaman adımı simülasyonu (Zod doğrulama ile Basic veya Smart) |
| `POST` | `/api/energy/run-scenario` | 24 saatlik senaryoyu koşar, Basic vs Smart karşılaştırma raporu üretir |
| `GET` | `/api/energy/metrics` | Ham zaman serisi verileri |
| `GET` | `/api/energy/metrics/aggregated` | TimescaleDB `time_bucket()` ile özetlenmiş Chart.js verisi |

---

## 🧪 Birim Testleri (Unit Tests)

Karar algoritmalarımızın (Basic & Smart Strategy) matematiksel doğruluğunu test etmek için:

```bash
npm test
```
*(Node.js yerleşik test motoru ile `tests/energy-strategy.test.ts` dosyasını çalıştırır).*

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
