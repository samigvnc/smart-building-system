import { randomUUID } from 'node:crypto';
import { AppError } from '../middlewares/error.middleware';
import { SimulationRunsRepository } from '../repositories/simulation-data.repository';
import { SimulationRunParams } from '../validators/simulation.validator';
import { SimulationInputService } from './simulation-input.service';
import { SimulationEngineClient } from './core-engine.client';
import { SimulationEngineRequest, StrategyComparisonResult } from '../types/simulation-contract';

export interface SimulationRunOutcome {
  /** simulation_runs kaydının kimliği; DB'ye yazılamadıysa null. */
  runId: string | null;
  taskId: string;
  dataDate: string;
  request: Omit<SimulationEngineRequest, 'hourlyInputs'>;
  result: StrategyComparisonResult;
}

/**
 * Simülasyon akışının orkestrasyonu:
 *   1) Veriyi DB'den hazırla  2) Core Engine'e (Java) gönder  3) Sonucu sakla ve döndür.
 * Basic/Smart hesapları, senaryo uygulaması ve metrikler Core Engine'dedir; burada tekrar edilmez.
 */
export class SimulationService {
  constructor(
    private readonly inputService: SimulationInputService,
    private readonly engine: SimulationEngineClient,
    private readonly runsRepository: SimulationRunsRepository
  ) {}

  public async run(params: SimulationRunParams): Promise<SimulationRunOutcome> {
    const { date, hourlyInputs } = await this.inputService.buildInputs({
      date: params.date,
      source: params.source,
      criticalBuildings: params.criticalBuildings,
    });

    const request: SimulationEngineRequest = {
      taskId: randomUUID(),
      requestedAt: new Date().toISOString(),
      batteryCapacityKwh: params.batteryCapacityKwh,
      initialBatterySocKwh: params.initialBatterySocKwh ?? params.batteryCapacityKwh / 2,
      criticalBuildings: params.criticalBuildings,
      scenarioConditions: params.scenarioConditions,
      smartStrategyConfig: params.smartStrategyConfig,
      hourlyInputs,
    };

    const response = await this.engine.run(request);

    if (response.status === 'ERROR') {
      throw new AppError(`Core Engine simülasyonu reddetti: ${response.errorMessage ?? 'bilinmeyen hata'}`, 422);
    }
    if (!response.result) {
      throw new AppError('Core Engine başarılı yanıt verdi ama sonuç içermiyor.', 502);
    }
    if (response.taskId !== request.taskId) {
      throw new AppError('Core Engine yanıtındaki taskId isteğiyle eşleşmiyor.', 502);
    }

    let runId: string | null = null;
    try {
      runId = await this.runsRepository.save(date, request, response.result);
    } catch (err: any) {
      console.warn('[SimulationService] Çalıştırma kaydı DB\'ye yazılamadı:', err.message);
    }

    const { hourlyInputs: _omit, ...requestSummary } = request;
    return { runId, taskId: request.taskId, dataDate: date, request: requestSummary, result: response.result };
  }
}
