import { Request, Response, NextFunction } from 'express';
import { ENV } from '../config/env';
import { AppError } from '../middlewares/error.middleware';
import {
  PgSimulationDataRepository,
  PgSimulationRunsRepository,
  getProfileSetSummaries,
  SimulationRunsRepository,
} from '../repositories/simulation-data.repository';
import { SimulationInputService } from '../services/simulation-input.service';
import { RabbitMqSimulationEngineClient } from '../services/core-engine.client';
import { SimulationService } from '../services/simulation.service';
import {
  runIdParamSchema,
  runsListQuerySchema,
  simulationInputsQuerySchema,
  simulationRunSchema,
} from '../validators/simulation.validator';
import { BuildingType } from '../types/energy.types';
import { SCENARIO_TYPES } from '../types/simulation-contract';

export class SimulationController {
  private runsRepository: SimulationRunsRepository = new PgSimulationRunsRepository();
  private inputService = new SimulationInputService(new PgSimulationDataRepository());
  private simulationService = new SimulationService(
    this.inputService,
    new RabbitMqSimulationEngineClient(),
    this.runsRepository
  );

  /**
   * Backend ile Core Engine'in ortak varsayılanları (Frontend formu bunlarla doldurulabilir).
   * GET /api/simulation/defaults
   */
  public getDefaults = (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      data: {
        buildingTypes: Object.values(BuildingType),
        scenarioTypes: SCENARIO_TYPES,
        criticalBuildings: ENV.SIMULATION.CRITICAL_BUILDINGS,
        batteryCapacityKwh: ENV.STRATEGY_DEFAULTS.BATTERY_MAX_CAPACITY_KWH,
        smartStrategyConfig: {
          minimumReservePercent: ENV.STRATEGY_DEFAULTS.BATTERY_MIN_RESERVE_PERCENT,
          highPriceThreshold: ENV.SIMULATION.HIGH_PRICE_THRESHOLD,
          outageLookAheadHours: ENV.SIMULATION.OUTAGE_LOOKAHEAD_HOURS,
        },
      },
    });
  };

  /**
   * Hazır profil setleri (source) ve kapsadıkları tarih aralığı.
   * GET /api/simulation/data-summary
   */
  public getDataSummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ success: true, data: await getProfileSetSummaries() });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DB'den hazırlanan 24 saatlik Core Engine girdisini döner (Core Engine'e gitmeden önizleme).
   * GET /api/simulation/inputs?date=2026-01-01&source=dev&criticalBuildings=LABORATORY,LIBRARY
   */
  public getInputs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = simulationInputsQuerySchema.parse(req.query);
      const built = await this.inputService.buildInputs({
        date: query.date,
        source: query.source,
        criticalBuildings: query.criticalBuildings ?? ENV.SIMULATION.CRITICAL_BUILDINGS,
      });
      res.status(200).json({ success: true, date: built.date, data: built.hourlyInputs });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Core Engine'de Basic vs Smart karşılaştırmalı 24 saatlik simülasyon çalıştırır.
   * POST /api/simulation/run
   */
  public run = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const params = simulationRunSchema.parse(req.body ?? {});
      const outcome = await this.simulationService.run(params);
      res.status(200).json({ success: true, ...outcome });
    } catch (error) {
      next(error);
    }
  };

  /** GET /api/simulation/runs?limit=20 */
  public listRuns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit } = runsListQuerySchema.parse(req.query);
      const runs = await this.runsRepository.list(limit);
      res.status(200).json({ success: true, count: runs.length, data: runs });
    } catch (error) {
      next(error);
    }
  };

  /** GET /api/simulation/runs/:id */
  public getRun = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = runIdParamSchema.parse(req.params);
      const run = await this.runsRepository.findById(id);
      if (!run) throw new AppError('Simülasyon kaydı bulunamadı.', 404);
      res.status(200).json({ success: true, data: run });
    } catch (error) {
      next(error);
    }
  };
}
