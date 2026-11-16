import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EnergyStrategyService } from '../src/services/energy-strategy.service';
import { BuildingType, EnergyEnvironmentInput } from '../src/types/energy.types';

describe('EnergyStrategyService - İş Mantığı ve Karar Mekanizması Testleri', () => {
  const strategyService = new EnergyStrategyService();

  const standardBuildings = [
    {
      id: 'b1',
      name: 'Biyoteknoloji Laboratuvarı',
      type: BuildingType.LABORATORY,
      isCritical: true,
      demandKWh: 20,
    },
    {
      id: 'b2',
      name: 'Merkez Kütüphane',
      type: BuildingType.LIBRARY,
      isCritical: true,
      demandKWh: 15,
    },
    {
      id: 'b3',
      name: 'Öğrenci Yurdu A Blok',
      type: BuildingType.DORMITORY,
      isCritical: false,
      demandKWh: 25,
    },
  ]; // Toplam talep: 60 kWh

  it('Basic Strategy: Güneş üretimi fazlaysa önce binalar beslenmeli ve artan bataryaya şarj edilmeli', () => {
    const input: EnergyEnvironmentInput = {
      timestamp: new Date().toISOString(),
      solarGenerationKWh: 80, // Talep 60 kWh, Fazla 20 kWh
      buildings: standardBuildings,
      battery: {
        currentCapacityKWh: 30,
        maxCapacityKWh: 100,
        minReservePercent: 20,
      },
      isGridAvailable: true,
      gridElectricityPrice: 0.18,
    };

    const result = strategyService.executeBasicStrategy(input);

    assert.strictEqual(result.solarUsedKWh, 60, 'Solar tüm 60 kWh talebi karşılamalı');
    assert.strictEqual(result.batteryChargedKWh, 20, 'Kalan 20 kWh bataryaya doldurulmalı');
    assert.strictEqual(result.finalBatteryCapacityKWh, 50, 'Batarya kapasitesi 30 + 20 = 50 kWh olmalı');
    assert.strictEqual(result.gridImportKWh, 0, 'Şebekeden alım yapılmamalı');
    assert.strictEqual(result.unservedEnergyKWh, 0, 'Karşılanamayan enerji 0 olmalı');
  });

  it('Basic Strategy: Şebeke kesikse ve batarya yetersizse Unserved Energy kaydedilmeli', () => {
    const input: EnergyEnvironmentInput = {
      timestamp: new Date().toISOString(),
      solarGenerationKWh: 20, // 40 kWh açık var
      buildings: standardBuildings, // 60 kWh talep
      battery: {
        currentCapacityKWh: 15, // Bataryada sadece 15 kWh var
        maxCapacityKWh: 100,
        minReservePercent: 0,
      },
      isGridAvailable: false, // ŞEBEKE KESİK
      gridElectricityPrice: 0.18,
    };

    const result = strategyService.executeBasicStrategy(input);

    assert.strictEqual(result.solarUsedKWh, 20);
    assert.strictEqual(result.batteryDischargedKWh, 15);
    assert.strictEqual(result.finalBatteryCapacityKWh, 0, 'Batarya tamamen tükenmeli');
    assert.strictEqual(result.unservedEnergyKWh, 25, 'Kalan 25 kWh karşılanamamalı (Unserved)');
  });

  it('Smart Strategy: Şebeke aktif ve elektrik ucuzsa batarya harcanmamalı, şebekeden çekilmeli (Fiyat Arbitrajı)', () => {
    const input: EnergyEnvironmentInput = {
      timestamp: new Date().toISOString(),
      solarGenerationKWh: 10, // 50 kWh açık
      buildings: standardBuildings, // 60 kWh talep
      battery: {
        currentCapacityKWh: 80, // Bataryada bolca enerji var ama harcanmamalı!
        maxCapacityKWh: 100,
        minReservePercent: 20,
      },
      isGridAvailable: true,
      gridElectricityPrice: 0.10, // 0.15 eşiğinin altında -> UCUZ
      priceThresholdCheap: 0.15,
    };

    const result = strategyService.executeSmartStrategy(input);

    assert.strictEqual(result.batteryDischargedKWh, 0, 'Elektrik ucuzken batarya harcanmamalı');
    assert.strictEqual(result.gridImportKWh, 50, 'Açık kalan 50 kWh ucuz şebekeden çekilmeli');
    assert.strictEqual(result.finalBatteryCapacityKWh, 80, 'Batarya kapasitesi aynen korunmalı');
  });

  it('Smart Strategy: Şebeke kesintisinde kritik binalar (Lab & Library) beslenmeli, Dormitory kesilmeli (Load Shedding)', () => {
    const input: EnergyEnvironmentInput = {
      timestamp: new Date().toISOString(),
      solarGenerationKWh: 15,
      buildings: standardBuildings, // Lab: 20 kWh, Lib: 15 kWh, Dorm: 25 kWh (Toplam: 60 kWh)
      battery: {
        currentCapacityKWh: 20, // Toplam temin edilebilir: 15 (solar) + 20 (batarya) = 35 kWh
        maxCapacityKWh: 100,
        minReservePercent: 20,
      },
      isGridAvailable: false, // ŞEBEKE KESİK
      gridElectricityPrice: 0.25,
    };

    const result = strategyService.executeSmartStrategy(input);

    // Mevcut enerji: 35 kWh
    // Öncelik: Lab (20 kWh) + Lib (15 kWh) = Tam 35 kWh!
    // Dormitory (25 kWh) -> Tamamen enerjisi kesilmeli (0 kWh almalı)
    const labAlloc = result.allocations.find((a) => a.type === BuildingType.LABORATORY);
    const libAlloc = result.allocations.find((a) => a.type === BuildingType.LIBRARY);
    const dormAlloc = result.allocations.find((a) => a.type === BuildingType.DORMITORY);

    assert.strictEqual(labAlloc?.allocatedKWh, 20, 'Laboratuvar %100 beslenmeli');
    assert.strictEqual(libAlloc?.allocatedKWh, 15, 'Kütüphane %100 beslenmeli');
    assert.strictEqual(dormAlloc?.allocatedKWh, 0, 'Yurt (Dormitory) enerjisi kesilmeli (Load Shedded)');
    assert.strictEqual(dormAlloc?.isShedded, true, 'Yurt isShedded=true olarak işaretlenmeli');
  });
});

