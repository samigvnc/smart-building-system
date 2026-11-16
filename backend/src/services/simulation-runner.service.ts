import {
  HourlyEnvironmentProfile,
  SimulationComparisonReport,
  SimulationScenarioConfig,
  StrategyComparisonMetrics,
} from '../types/simulation.types';
import { BuildingType, EnergyEnvironmentInput, StrategyDecisionResult } from '../types/energy.types';
import { EnergyStrategyService } from './energy-strategy.service';

export class SimulationRunnerService {
  private strategyService = new EnergyStrategyService();

  /**
   * 24 saatlik sentetik ve gerçekçi kampüs enerji ortamı profili üretir.
   */
  public generateCampusProfile(config: SimulationScenarioConfig): HourlyEnvironmentProfile[] {
    const profile: HourlyEnvironmentProfile[] = [];
    const cloudyFactor = config.cloudyDayFactor ?? 1.0;

    for (let h = 0; h < config.durationHours; h++) {
      // 1. Güneş Üretim Eğrisi (06:00 - 19:00 arası tepe noktası saat 13:00)
      let baseSolar = 0;
      if (h >= 6 && h <= 19) {
        const solarHour = h - 6;
        baseSolar = Math.sin((solarHour / 13) * Math.PI) * 60; // Max 60 kWh güneş
      }
      const solarKWh = Number(Math.max(0, baseSolar * cloudyFactor).toFixed(2));

      // 2. Elektrik Fiyat Eğrisi (Time of Use - TOU)
      let price = 0.18; // Normal tarife
      if (config.priceModel === 'TIME_OF_USE') {
        if (h >= 0 && h < 6) {
          price = 0.09; // Gece ucuz tarife (Valley)
        } else if (h >= 17 && h <= 21) {
          price = 0.38; // Akşam pik saatler (Peak / Demand Spike)
        } else {
          price = 0.18; // Gündüz normal
        }
      }

      // 3. Şebeke Kesintisi (Grid Outage) Senaryosu
      let isGridAvailable = true;
      if (
        config.gridOutageStartHour !== undefined &&
        config.gridOutageDurationHours !== undefined &&
        h >= config.gridOutageStartHour &&
        h < config.gridOutageStartHour + config.gridOutageDurationHours
      ) {
        isGridAvailable = false;
      }

      // 4. Bina Tüketimleri
      const labDemand = h >= 8 && h <= 18 ? 28 + (h % 3) * 2 : 8;
      const libDemand = h >= 9 && h <= 23 ? 18 + (h % 2) * 3 : 5;
      let dormDemand = 12;
      if ((h >= 7 && h <= 9) || (h >= 18 && h <= 23)) {
        dormDemand = 32 + (h % 4) * 3;
      }

      const timestamp = new Date(Date.UTC(2026, 10, 7, h, 0, 0)).toISOString();

      profile.push({
        hour: h,
        timestamp,
        solarGenerationKWh: solarKWh,
        gridElectricityPrice: price,
        isGridAvailable,
        buildings: [
          {
            id: 'bld-lab-01',
            name: 'Biyoteknoloji & Temiz Oda Laboratuvarı',
            type: BuildingType.LABORATORY,
            isCritical: true,
            demandKWh: labDemand,
          },
          {
            id: 'bld-lib-01',
            name: 'Merkez Kütüphane & Veri Merkezi',
            type: BuildingType.LIBRARY,
            isCritical: true,
            demandKWh: libDemand,
          },
          {
            id: 'bld-dorm-01',
            name: 'Öğrenci Yurdu A Blok',
            type: BuildingType.DORMITORY,
            isCritical: false,
            demandKWh: dormDemand,
          },
        ],
      });
    }

    return profile;
  }

  /**
   * Hem Basic hem Smart stratejiyi simüle edip karşılaştırma raporu sunar.
   */
  public runComparisonSimulation(config: SimulationScenarioConfig): SimulationComparisonReport {
    const profile = this.generateCampusProfile(config);

    // 1. Basic Stratejiyi Koş
    const basicDecisions: StrategyDecisionResult[] = [];
    let basicBatteryKWh = config.initialBatteryKWh;

    for (const hourData of profile) {
      const input: EnergyEnvironmentInput = {
        timestamp: hourData.timestamp,
        solarGenerationKWh: hourData.solarGenerationKWh,
        buildings: hourData.buildings,
        battery: {
          currentCapacityKWh: basicBatteryKWh,
          maxCapacityKWh: config.batteryCapacityKWh,
          minReservePercent: 0,
        },
        isGridAvailable: hourData.isGridAvailable,
        gridElectricityPrice: hourData.gridElectricityPrice,
      };

      const result = this.strategyService.executeBasicStrategy(input);
      basicBatteryKWh = result.finalBatteryCapacityKWh;
      basicDecisions.push(result);
    }

    // 2. Smart Stratejiyi Koş
    const smartDecisions: StrategyDecisionResult[] = [];
    let smartBatteryKWh = config.initialBatteryKWh;

    for (const hourData of profile) {
      const input: EnergyEnvironmentInput = {
        timestamp: hourData.timestamp,
        solarGenerationKWh: hourData.solarGenerationKWh,
        buildings: hourData.buildings,
        battery: {
          currentCapacityKWh: smartBatteryKWh,
          maxCapacityKWh: config.batteryCapacityKWh,
          minReservePercent: 20, // %20 Rezerv kuralı
        },
        isGridAvailable: hourData.isGridAvailable,
        gridElectricityPrice: hourData.gridElectricityPrice,
        priceThresholdCheap: 0.15,
      };

      const result = this.strategyService.executeSmartStrategy(input);
      smartBatteryKWh = result.finalBatteryCapacityKWh;
      smartDecisions.push(result);
    }

    // 3. Metrikleri ve Karşılaştırmayı Hesapla
    const basicMetrics = this.calculateMetrics(profile, basicDecisions);
    const smartMetrics = this.calculateMetrics(profile, smartDecisions);

    const savingsUSD = Number((basicMetrics.totalElectricityCostUSD - smartMetrics.totalElectricityCostUSD).toFixed(2));
    const unservedReduction =
      basicMetrics.totalUnservedEnergyKWh > 0
        ? Number(
            (
              ((basicMetrics.totalUnservedEnergyKWh - smartMetrics.totalUnservedEnergyKWh) /
                basicMetrics.totalUnservedEnergyKWh) *
              100
            ).toFixed(1)
          )
        : 0;

    let summaryVerdict = `Smart Strateji, Basic yaklaşıma kıyasla \$${Math.abs(savingsUSD)} ${
      savingsUSD >= 0 ? 'maliyet tasarrufu sağladı' : 'maliyet farkı yarattı'
    }. `;
    summaryVerdict += `Kritik binaların (Lab & Library) uptime oranı Smart stratejide %${smartMetrics.criticalBuildingsUptimePercent} iken, Basic stratejide %${basicMetrics.criticalBuildingsUptimePercent} olarak gerçekleşti.`;

    return {
      scenarioName: config.scenarioName,
      durationHours: config.durationHours,
      basicStrategyReport: basicMetrics,
      smartStrategyReport: smartMetrics,
      savingsUSD,
      unservedEnergyReductionPercent: unservedReduction,
      summaryVerdict,
    };
  }

  private calculateMetrics(
    profile: HourlyEnvironmentProfile[],
    decisions: StrategyDecisionResult[]
  ): StrategyComparisonMetrics {
    let totalDemand = 0;
    let totalSolarUsed = 0;
    let totalBatteryDischarged = 0;
    let totalGridImport = 0;
    let totalUnservedEnergy = 0;
    let totalElectricityCostUSD = 0;

    let criticalBuildingTotalHours = 0;
    let criticalBuildingServedHours = 0;
    let dormitorySheddingHours = 0;

    for (let i = 0; i < decisions.length; i++) {
      const dec = decisions[i];
      const prof = profile[i];

      totalDemand += dec.totalDemandKWh;
      totalSolarUsed += dec.solarUsedKWh;
      totalBatteryDischarged += dec.batteryDischargedKWh;
      totalGridImport += dec.gridImportKWh;
      totalUnservedEnergy += dec.unservedEnergyKWh;
      totalElectricityCostUSD += dec.gridImportKWh * prof.gridElectricityPrice;

      for (const alloc of dec.allocations) {
        if (alloc.type === BuildingType.LABORATORY || alloc.type === BuildingType.LIBRARY) {
          criticalBuildingTotalHours++;
          if (alloc.unservedKWh === 0) {
            criticalBuildingServedHours++;
          }
        } else if (alloc.type === BuildingType.DORMITORY) {
          if (alloc.isShedded) {
            dormitorySheddingHours++;
          }
        }
      }
    }

    const uptimePercent =
      criticalBuildingTotalHours > 0
        ? Number(((criticalBuildingServedHours / criticalBuildingTotalHours) * 100).toFixed(1))
        : 100;

    return {
      totalDemandKWh: Number(totalDemand.toFixed(2)),
      totalSolarUsedKWh: Number(totalSolarUsed.toFixed(2)),
      totalBatteryDischargedKWh: Number(totalBatteryDischarged.toFixed(2)),
      totalGridImportKWh: Number(totalGridImport.toFixed(2)),
      totalUnservedEnergyKWh: Number(totalUnservedEnergy.toFixed(2)),
      totalElectricityCostUSD: Number(totalElectricityCostUSD.toFixed(2)),
      criticalBuildingsUptimePercent: uptimePercent,
      dormitorySheddingHours,
      decisions,
    };
  }
}

