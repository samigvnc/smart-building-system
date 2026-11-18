# Backend ↔ Core Engine (Java) Sözleşmesi

Amaç: **tek bir simülasyon mantığı** olsun. Basic/Smart stratejiler, senaryo uygulaması ve metrikler
**Core Engine'de (Java)** çalışır. Backend (Node.js) yalnızca şunları yönetir:

| Backend'in işi | Core Engine'in işi |
|---|---|
| İstek doğrulama, varsayılanlar (kritik bina, %25 rezerv...) | `SimulationEngine`, `BasicStrategy`, `SmartStrategy` |
| Veriyi DB'den hazırlama (BDG2, NSRDB, tarife) | `ScenarioProcessor`, `SimulationMetricsCalculator` |
| Core Engine'i çağırma, sonucu saklama (`simulation_runs`) | `StrategyComparisonResult` üretme |
| REST API (`/api/simulation/*`) — Frontend buraya bağlanır | — |

Alan adları Java record'larıyla **birebir** aynıdır (Jackson varsayılan camelCase). Tipler:
[`src/types/simulation-contract.ts`](../src/types/simulation-contract.ts).

## Taşıma: RabbitMQ istek-yanıt (RPC)

- İstek kuyruğu: `core_engine_queue` (`RABBITMQ_CORE_ENGINE_QUEUE`), `durable: true`.
- Backend isteği şu özelliklerle yollar: `correlationId`, `replyTo = amq.rabbitmq.reply-to`
  (RabbitMQ "direct reply-to"), `contentType = application/json`, `expiration = CORE_ENGINE_TIMEOUT_MS`.
- Core Engine yanıtı, mesajın **`replyTo` adresine ve aynı `correlationId` ile** yollar.
  (Spring AMQP'de `@RabbitListener` metodu bir nesne döndürürse yanıt otomatik `replyTo`'ya gider;
  JSON için `Jackson2JsonMessageConverter` kullanılmalıdır.)
- Yanıt gelmezse backend `504` döner.

## İstek (`SimulationEngineRequest`)

`SimulationRequest` record'unun 5 alanı + `taskId`, `requestedAt`, `hourlyInputs`:

```json
{
  "taskId": "8f1c...",
  "requestedAt": "2026-11-18T12:00:00.000Z",
  "batteryCapacityKwh": 100,
  "initialBatterySocKwh": 50,
  "criticalBuildings": ["LABORATORY"],
  "scenarioConditions": [
    { "type": "GRID_OUTAGE", "startHour": 18, "endHour": 20, "factor": 1 }
  ],
  "smartStrategyConfig": {
    "minimumReservePercent": 25,
    "highPriceThreshold": 2.5,
    "outageLookAheadHours": 3
  },
  "hourlyInputs": [
    {
      "hour": 0,
      "demandKwh": 30.5,
      "buildingLoads": [
        { "buildingType": "DORMITORY",  "critical": false, "demandKwh": 12.25 },
        { "buildingType": "LIBRARY",    "critical": false, "demandKwh": 8.75 },
        { "buildingType": "LABORATORY", "critical": true,  "demandKwh": 8.75 },
        { "buildingType": "CAFETERIA",  "critical": false, "demandKwh": 0.75 }
      ],
      "solarGenerationKwh": 0,
      "gridAvailable": true,
      "batteryAvailable": true,
      "gridPricePerKwh": 1.5
    }
  ]
}
```

Kurallar (Java'daki doğrulamalarla aynı):
- `hourlyInputs`: **tam 24 adet**, `hour` 0..23 sıralı. `demandKwh` = `buildingLoads` toplamı.
- `buildingType`: `DORMITORY | LIBRARY | LABORATORY | CAFETERIA`.
- `scenarioConditions[].type`: `NORMAL_DAY | CLOUDY_DAY | GRID_OUTAGE | BATTERY_FAILURE | DEMAND_SPIKE`;
  `CLOUDY_DAY.factor` 0..1, `DEMAND_SPIKE.factor` ≥ 1.
- Backend `hourlyInputs` içinde `gridAvailable`/`batteryAvailable` değerlerini her zaman `true` yollar;
  kesinti/arıza **senaryo koşullarıyla** Core Engine'de uygulanır.

**Java tarafında yapılacak:** gövdeyi `SimulationRequest`'e çevir, `hourlyInputs`'u bir
`SimulationInputProvider` olarak ver ve çağır:

```java
StrategyComparisonResult r = simulationService.run(request, () -> hourlyInputs);
```

(`CsvSimulationInputProvider` yerine bu "payload provider" kullanılır; CSV'ler geliştirme verisi olarak kalır.)

## Yanıt (`SimulationEngineResponse`)

```json
{
  "taskId": "8f1c...",
  "status": "OK",
  "result": {
    "basic": { "summary": { "strategyName": "Basic Strategy", "totalCost": 0, "gridUsageKwh": 0,
                            "solarUsageKwh": 0, "batteryUsageKwh": 0, "unservedEnergyKwh": 0,
                            "renewableUtilizationPercent": 0, "finalBatterySocKwh": 0 },
               "hourlyResults": [ { "hour": 0, "demandKwh": 0, "solarAvailableKwh": 0, "solarToLoadKwh": 0,
                                    "solarToBatteryKwh": 0, "batteryToLoadKwh": 0, "gridToLoadKwh": 0,
                                    "unservedEnergyKwh": 0, "curtailedSolarKwh": 0, "batterySocEndKwh": 0,
                                    "cost": 0,
                                    "buildingResults": [ { "buildingType": "LABORATORY", "critical": true,
                                                           "demandKwh": 0, "servedEnergyKwh": 0,
                                                           "unservedEnergyKwh": 0 } ] } ] },
    "smart": { "summary": { }, "hourlyResults": [ ] }
  }
}
```

Hata durumunda (ör. `IllegalArgumentException`): `{ "taskId": "...", "status": "ERROR", "errorMessage": "..." }`.
`taskId` isteğindekiyle **aynı** olmalıdır; aksi halde backend `502` döner.

## Ortak varsayılanlar

Backend'de `.env`, Java'da `SmartStrategyConfig.defaultConfig()` — ikisi aynı olmalı:

| Ayar | Değer | Backend `.env` anahtarı |
|---|---|---|
| Kritik binalar | `LABORATORY` (yapılandırılabilir) | `CRITICAL_BUILDINGS` |
| Minimum batarya rezervi | `%25` | `BATTERY_MIN_RESERVE_PERCENT` |
| Yüksek fiyat eşiği | `2.5` | `SIMULATION_HIGH_PRICE_THRESHOLD` |
| Kesinti ön bakış | `3` saat | `SIMULATION_OUTAGE_LOOKAHEAD_HOURS` |

Frontend bu değerleri `GET /api/simulation/defaults` ile okur.

## Veri akışı (BDG2 hazır olunca)

```
BDG2 / NSRDB / tarife CSV ──(npm run import:data)──► TimescaleDB
        building_demand_readings · solar_readings · grid_price_profile
                                              │
POST /api/simulation/run ──► backend 24 saatlik girdi hazırlar ──► core_engine_queue ──► Java
                                              ◄────────── StrategyComparisonResult ◄──┘
```

Şu an geliştirme verisi için: `npm run seed:dev` (Core Engine'in `src/main/resources/data` CSV'lerini yükler).

## Henüz netleşmesi gerekenler

1. **Taşıma:** RabbitMQ RPC önerildi (mimaride zaten var). Java tarafı HTTP tercih ederse yalnızca
   `src/services/core-engine.client.ts` değişir; sözleşme aynı kalır.
2. **Fiyat birimi:** Java `price.csv` ve `highPriceThreshold` (2.5) para birimi/kWh; canlı sensör akışındaki
   "ucuz" eşiği (`ELECTRICITY_CHEAP_PRICE_THRESHOLD=0.15`) farklı ölçekte. Tek birim üzerinde anlaşılmalı.
3. **Canlı karar mantığı:** Sensörden gelen anlık karar akışı (`EnergyStrategyService`) şimdilik backend'de
   duruyor (Core Engine 24 saatlik toplu simülasyon). Ortak kural: kritik binalar önce, %25 rezerv. Smart stratejinin
   kendisi ise iki yerde farklı (backend: ucuz fiyatta bataryayı koru; Java: pahalı fiyatta ve kesinti
   yaklaşmıyorsa deşarj et). Canlı akışın da Core Engine'e taşınıp taşınmayacağına birlikte karar verilmeli.
