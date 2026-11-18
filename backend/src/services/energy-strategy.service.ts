import {
  BuildingEnergyAllocation,
  EnergyEnvironmentInput,
  StrategyDecisionResult,
} from '../types/energy.types';
import { ENV } from '../config/env';

export class EnergyStrategyService {
  /**
   * 1. BASIC STRATEGY (Sıralı Yaklaşım)
   * Adımlar:
   * 1. Solar vs Toplam Talep
   * 2. Fazla Solar -> Bataryaya şarj
   * 3. Eksik Enerji -> Bataryadan çek (batarya bitene kadar)
   * 4. Hâlâ açık varsa -> Şebekeden (Grid) çek (şebeke varsa)
   * 5. Şebeke yoksa -> Karşılanamayan açık: Unserved Energy
   */
  public executeBasicStrategy(input: EnergyEnvironmentInput): StrategyDecisionResult {
    const notes: string[] = [];
    const totalDemand = input.buildings.reduce((sum, b) => sum + b.demandKWh, 0);

    let remainingDemand = totalDemand;
    let solarUsed = 0;
    let batteryCharged = 0;
    let batteryDischarged = 0;
    let gridImport = 0;
    let unservedEnergy = 0;
    let currentBattery = input.battery.currentCapacityKWh;

    notes.push(`[Basic] Toplam Talep: ${totalDemand} kWh, Solar Üretim: ${input.solarGenerationKWh} kWh`);

    // Adım 1 & 2: Güneş Enerjisi Kullanımı
    if (input.solarGenerationKWh >= remainingDemand) {
      solarUsed = remainingDemand;
      const surplusSolar = input.solarGenerationKWh - remainingDemand;
      remainingDemand = 0;

      // Artan enerjiyi bataryaya şarj et (Kapasiteyi aşmayacak şekilde)
      const chargeSpace = input.battery.maxCapacityKWh - currentBattery;
      batteryCharged = Math.min(surplusSolar, chargeSpace);
      currentBattery += batteryCharged;
      notes.push(`[Basic] Güneş talebi tam karşıladı. ${batteryCharged.toFixed(2)} kWh bataryaya aktarıldı.`);
    } else {
      solarUsed = input.solarGenerationKWh;
      remainingDemand -= solarUsed;
      notes.push(`[Basic] Güneş enerjisi kısmi karşıladı (${solarUsed} kWh). Kalan açık: ${remainingDemand.toFixed(2)} kWh`);

      // Adım 3: Bataryadan Karşıla (0 kWh'ye kadar boşaltılabilir)
      const availableBattery = Math.max(0, currentBattery);
      if (availableBattery > 0) {
        batteryDischarged = Math.min(remainingDemand, availableBattery);
        remainingDemand -= batteryDischarged;
        currentBattery -= batteryDischarged;
        notes.push(`[Basic] Bataryadan ${batteryDischarged.toFixed(2)} kWh çekildi. Kalan batarya: ${currentBattery.toFixed(2)} kWh`);
      }

      // Adım 4 & 5: Şebeke veya Karşılanamayan Enerji
      if (remainingDemand > 0) {
        if (input.isGridAvailable) {
          gridImport = remainingDemand;
          remainingDemand = 0;
          notes.push(`[Basic] Kalan ${gridImport.toFixed(2)} kWh şebekeden çekildi.`);
        } else {
          unservedEnergy = remainingDemand;
          remainingDemand = 0;
          notes.push(`[Basic] UYARI: Şebeke kesik! ${unservedEnergy.toFixed(2)} kWh karşılanamadı (Unserved Energy).`);
        }
      }
    }

    // Basit stratejide binalara eşit/oransal dağıtım yapılır
    const servedEnergy = totalDemand - unservedEnergy;
    const fulfillmentRatio = totalDemand > 0 ? servedEnergy / totalDemand : 1;

    const allocations: BuildingEnergyAllocation[] = input.buildings.map((b) => {
      const allocated = b.demandKWh * fulfillmentRatio;
      const unserved = b.demandKWh - allocated;
      return {
        buildingId: b.id,
        buildingName: b.name,
        type: b.type,
        requestedKWh: b.demandKWh,
        allocatedKWh: Number(allocated.toFixed(2)),
        unservedKWh: Number(unserved.toFixed(2)),
        isShedded: unserved > 0.01,
      };
    });

    return {
      timestamp: input.timestamp,
      strategyUsed: 'BASIC',
      totalDemandKWh: totalDemand,
      solarUsedKWh: Number(solarUsed.toFixed(2)),
      batteryChargedKWh: Number(batteryCharged.toFixed(2)),
      batteryDischargedKWh: Number(batteryDischarged.toFixed(2)),
      gridImportKWh: Number(gridImport.toFixed(2)),
      unservedEnergyKWh: Number(unservedEnergy.toFixed(2)),
      finalBatteryCapacityKWh: Number(currentBattery.toFixed(2)),
      finalBatteryPercentage: Number(((currentBattery / input.battery.maxCapacityKWh) * 100).toFixed(1)),
      allocations,
      notes,
    };
  }

  /**
   * 2. SMART STRATEGY (Kural Tabanlı ve Öncelikli Yaklaşım)
   * Kurallar:
   * 1. Fiyat Eşiği Koruması: Şebeke aktif ve elektrik ucuzsa bataryayı deşarj etme, şebekeden al (Peak saatlere sakla).
   * 2. Rezerv Koruma: Normal şartlarda bataryada en az %20 rezerv bırak.
   * 3. Şebeke Kesintisi & Yetersiz Enerji: Kritik binalara (Laboratory, Library) öncelik ver, Dormitory'yi kes (Load Shedding).
   */
  public executeSmartStrategy(input: EnergyEnvironmentInput): StrategyDecisionResult {
    const notes: string[] = [];
    const priceThreshold = input.priceThresholdCheap ?? 0.15;
    const isElectricityCheap = input.gridElectricityPrice <= priceThreshold;
    const minReserveKWh = (input.battery.maxCapacityKWh * (input.battery.minReservePercent ?? ENV.STRATEGY_DEFAULTS.BATTERY_MIN_RESERVE_PERCENT)) / 100;

    let currentBattery = input.battery.currentCapacityKWh;
    let solarGeneration = input.solarGenerationKWh;
    let solarUsed = 0;
    let batteryCharged = 0;
    let batteryDischarged = 0;
    let gridImport = 0;
    let unservedEnergy = 0;

    const totalDemand = input.buildings.reduce((sum, b) => sum + b.demandKWh, 0);
    let remainingDemand = totalDemand;

    notes.push(`[Smart] Talep: ${totalDemand} kWh, Solar: ${solarGeneration} kWh, Fiyat: ${input.gridElectricityPrice} $/kWh (Ucuz mu? ${isElectricityCheap ? 'Evet' : 'Hayır'}), Şebeke: ${input.isGridAvailable ? 'Aktif' : 'KESİK'}`);

    // Kural 1: Güneş enerjisi öncelikle talebi besler
    if (solarGeneration >= remainingDemand) {
      solarUsed = remainingDemand;
      const surplusSolar = solarGeneration - remainingDemand;
      remainingDemand = 0;

      // Artan güneş bataryaya şarj edilir
      const chargeSpace = input.battery.maxCapacityKWh - currentBattery;
      batteryCharged = Math.min(surplusSolar, chargeSpace);
      currentBattery += batteryCharged;
      notes.push(`[Smart] Güneş tüm talebi karşıladı. Artan ${batteryCharged.toFixed(2)} kWh bataryaya dolduruldu.`);
    } else {
      solarUsed = solarGeneration;
      remainingDemand -= solarUsed;
      notes.push(`[Smart] Güneş ${solarUsed.toFixed(2)} kWh karşıladı. Kalan açık: ${remainingDemand.toFixed(2)} kWh`);

      // Kural 2: Fiyat ve Şebeke Durumu Değerlendirmesi
      // Eğer şebeke aktifse VE elektrik ucuzsa -> Bataryayı harcama! Şebekeden çek, bataryayı pahalı saatlere sakla.
      if (input.isGridAvailable && isElectricityCheap) {
        gridImport = remainingDemand;
        remainingDemand = 0;
        notes.push(`[Smart Arbitraj] Elektrik fiyatı ucuz (${input.gridElectricityPrice} <= ${priceThreshold}). Batarya korunarak ${gridImport.toFixed(2)} kWh şebekeden alındı.`);
      } else {
        // Elektrik pahalı veya şebeke kesik -> Bataryayı devreye sok
        // Batarya güvenli kullanılabilir rezerv miktarı:
        // Eğer şebeke varsa rezerv seviyesine (%20) kadar kullan.
        // Eğer şebeke KESİKSE, kritik durum olduğu için rezervin altına kontrollü inilebilir.
        const usableBatteryLimit = input.isGridAvailable ? minReserveKWh : 0;
        const availableToDischarge = Math.max(0, currentBattery - usableBatteryLimit);

        if (availableToDischarge > 0) {
          batteryDischarged = Math.min(remainingDemand, availableToDischarge);
          remainingDemand -= batteryDischarged;
          currentBattery -= batteryDischarged;
          notes.push(`[Smart] Bataryadan ${batteryDischarged.toFixed(2)} kWh kullanıldı. Kalan Batarya: ${currentBattery.toFixed(2)} kWh (Min Rezerv: ${minReserveKWh} kWh)`);
        }

        // Hâlâ açık varsa ve şebeke varsa şebekeden çek
        if (remainingDemand > 0 && input.isGridAvailable) {
          gridImport = remainingDemand;
          remainingDemand = 0;
          notes.push(`[Smart] Batarya sonrası kalan ${gridImport.toFixed(2)} kWh şebekeden karşılandı.`);
        }
      }
    }

    // Kural 3: Şebeke Kesikse ve Hâlâ Karşılanamayan Talep Varsa -> LOAD SHEDDING (Öncelikli Dağıtım)
    const allocations: BuildingEnergyAllocation[] = [];
    if (remainingDemand > 0) {
      unservedEnergy = remainingDemand;
      notes.push(`[Smart ALERT] Şebeke kesik ve kaynaklar yetersiz! ${unservedEnergy.toFixed(2)} kWh enerji açığı var. Öncelikli Yük Atma (Load Shedding) devrede.`);

      // Mevcut toplam elde edilen temiz enerji miktarı (Güneş + Batarya)
      let availableTotalSupply = solarUsed + batteryDischarged;

      // Binaları önceliğe göre sırala: kritik (isCritical) binalar önce, diğerleri sonra.
      // Hangi binaların kritik olduğu yapılandırılabilir (CRITICAL_BUILDINGS) ve Core Engine ile ortaktır.
      // Array.prototype.sort kararlıdır: aynı öncelikteki binaların sırası korunur.
      const prioritizedBuildings = [...input.buildings].sort(
        (a, b) => Number(b.isCritical) - Number(a.isCritical)
      );

      for (const bld of prioritizedBuildings) {
        if (availableTotalSupply >= bld.demandKWh) {
          allocations.push({
            buildingId: bld.id,
            buildingName: bld.name,
            type: bld.type,
            requestedKWh: bld.demandKWh,
            allocatedKWh: bld.demandKWh,
            unservedKWh: 0,
            isShedded: false,
          });
          availableTotalSupply -= bld.demandKWh;
          notes.push(`[Smart Dağıtım] ${bld.name} (${bld.type}) talebi TAM karşılandı (${bld.demandKWh} kWh).`);
        } else if (availableTotalSupply > 0) {
          // Kısmi besleme
          allocations.push({
            buildingId: bld.id,
            buildingName: bld.name,
            type: bld.type,
            requestedKWh: bld.demandKWh,
            allocatedKWh: Number(availableTotalSupply.toFixed(2)),
            unservedKWh: Number((bld.demandKWh - availableTotalSupply).toFixed(2)),
            isShedded: true,
          });
          notes.push(`[Smart Dağıtım] ${bld.name} kısmi beslendi (${availableTotalSupply.toFixed(2)} kWh). Kalan kesildi.`);
          availableTotalSupply = 0;
        } else {
          // Tamamen enerjisi kesilen (Load Shedded) bina (örn: Dormitory)
          allocations.push({
            buildingId: bld.id,
            buildingName: bld.name,
            type: bld.type,
            requestedKWh: bld.demandKWh,
            allocatedKWh: 0,
            unservedKWh: bld.demandKWh,
            isShedded: true,
          });
          notes.push(`[Smart Load-Shedding] ${bld.name} (${bld.type}) enerjisi tamamen kesildi!`);
        }
      }
    } else {
      // Enerji fazlası veya tam karşılanma durumu: Her bina %100 beslenir
      for (const bld of input.buildings) {
        allocations.push({
          buildingId: bld.id,
          buildingName: bld.name,
          type: bld.type,
          requestedKWh: bld.demandKWh,
          allocatedKWh: bld.demandKWh,
          unservedKWh: 0,
          isShedded: false,
        });
      }
    }

    return {
      timestamp: input.timestamp,
      strategyUsed: 'SMART',
      totalDemandKWh: totalDemand,
      solarUsedKWh: Number(solarUsed.toFixed(2)),
      batteryChargedKWh: Number(batteryCharged.toFixed(2)),
      batteryDischargedKWh: Number(batteryDischarged.toFixed(2)),
      gridImportKWh: Number(gridImport.toFixed(2)),
      unservedEnergyKWh: Number(unservedEnergy.toFixed(2)),
      finalBatteryCapacityKWh: Number(currentBattery.toFixed(2)),
      finalBatteryPercentage: Number(((currentBattery / input.battery.maxCapacityKWh) * 100).toFixed(1)),
      allocations,
      notes,
    };
  }
}

