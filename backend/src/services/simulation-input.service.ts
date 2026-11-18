import { AppError } from '../middlewares/error.middleware';
import { BuildingType } from '../types/energy.types';
import { BuildingLoad, HourlyInput } from '../types/simulation-contract';
import { DayValues, SimulationDataRepository } from '../repositories/simulation-data.repository';

export interface BuildInputsParams {
  /** YYYY-MM-DD (UTC). Verilmezse güneş verisi tam olan en son gün kullanılır. */
  date?: string;
  /** Veri kaynağı filtresi (örn. 'bdg2', 'dev'). Verilmezse tüm kaynaklar. */
  source?: string;
  criticalBuildings: readonly BuildingType[];
}

export interface BuiltInputs {
  date: string;
  hourlyInputs: HourlyInput[];
}

/**
 * Veritabanındaki (BDG2 / NSRDB / tarife) verilerden Core Engine'in beklediği
 * 24 saatlik HourlyInput listesini üretir. Simülasyon mantığı BURADA DEĞİL, Core Engine'dedir.
 */
export class SimulationInputService {
  constructor(private readonly repository: SimulationDataRepository) {}

  public async buildInputs(params: BuildInputsParams): Promise<BuiltInputs> {
    const date = params.date ?? (await this.repository.findLatestCompleteDay(params.source));
    if (!date) {
      throw new AppError(
        'Simülasyon için tam (24 saatlik) güneş verisi olan bir gün bulunamadı. Önce veri içe aktarın (npm run seed:dev veya npm run import:data).',
        422
      );
    }

    const [demandByBuilding, solar, price] = await Promise.all([
      this.repository.getDemandForDay(date, params.source),
      this.repository.getSolarForDay(date, params.source),
      this.repository.getPriceProfile(),
    ]);

    if (demandByBuilding.size === 0) {
      throw new AppError(`${date} günü için bina tüketim verisi bulunamadı.`, 422);
    }
    this.assertComplete(solar, `${date} güneş üretimi`);
    this.assertComplete(price, 'Elektrik tarifesi (grid_price_profile)');
    for (const [type, values] of demandByBuilding) {
      this.assertComplete(values, `${date} ${type} tüketimi`);
    }

    // Bina sırası sabit olsun (Java tarafındaki BuildingType sırası)
    const buildingOrder = Object.values(BuildingType).filter((t) => demandByBuilding.has(t));
    const critical = new Set(params.criticalBuildings);

    const hourlyInputs: HourlyInput[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const buildingLoads: BuildingLoad[] = buildingOrder.map((type) => ({
        buildingType: type,
        critical: critical.has(type),
        demandKwh: demandByBuilding.get(type)![hour] as number,
      }));
      const demandKwh = buildingLoads.reduce((sum, l) => sum + l.demandKwh, 0);

      hourlyInputs.push({
        hour,
        demandKwh,
        buildingLoads,
        solarGenerationKwh: solar[hour] as number,
        gridAvailable: true, // Kesinti gibi durumlar senaryo koşullarıyla (Core Engine) uygulanır
        batteryAvailable: true,
        gridPricePerKwh: price[hour] as number,
      });
    }

    return { date, hourlyInputs };
  }

  private assertComplete(values: DayValues, label: string): void {
    const missing = values.map((v, h) => (v === undefined ? h : -1)).filter((h) => h >= 0);
    if (missing.length > 0) {
      throw new AppError(`${label} için eksik saatler var: ${missing.join(', ')}.`, 422);
    }
  }
}
