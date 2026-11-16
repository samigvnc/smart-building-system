import { Request, Response, NextFunction } from 'express';
import { EnergyStrategyService } from '../services/energy-strategy.service';
import { TimescaleService } from '../services/timescale.service';
import { SimulationRunnerService } from '../services/simulation-runner.service';
import { RabbitMQService } from '../message-brokers/rabbitmq.service';
import {
  simulateStepSchema,
  runScenarioSchema,
  metricsQuerySchema,
  aggregatedQuerySchema,
} from '../validators/energy.validator';
import { ENV } from '../config/env';
import { LiveDecisionBroadcastEvent } from '../types/rabbitmq-contracts';

export class EnergyController {
  private strategyService = new EnergyStrategyService();
  private timescaleService = new TimescaleService();
  private simulationRunner = new SimulationRunnerService();
  private rabbitmq = RabbitMQService.getInstance();

  /**
   * Tekil simülasyon adımı çalıştırma endpoint'i
   * POST /api/energy/simulate-step
   */
  public simulateStep = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Zod ile giriş verisini doğrula
      const validatedBody = simulateStepSchema.parse(req.body);
      const { strategy, environment } = validatedBody;

      // 1. İlgili stratejiyi çalıştır
      const decision =
        strategy === 'SMART'
          ? this.strategyService.executeSmartStrategy(environment)
          : this.strategyService.executeBasicStrategy(environment);

      // 2. TimescaleDB'ye yaz (DB kapalıysa hesaplanan karar yine de döndürülür)
      let persisted = true;
      await this.timescaleService.logEnergyMetrics(decision).catch((err) => {
        persisted = false;
        console.warn('[TimescaleDB] Karar kaydedilemedi:', err.message);
      });

      // 3. Kararı RabbitMQ üzerinden yayınla (canlı karar zarfı)
      const broadcast: LiveDecisionBroadcastEvent = {
        eventType: 'ENERGY_DECISION_UPDATED',
        timestamp: new Date().toISOString(),
        decision,
      };
      await this.rabbitmq.publishToQueue(ENV.RABBITMQ.DECISIONS_QUEUE, broadcast).catch((err) => {
        console.warn('[RabbitMQ] Karar kuyruğa gönderilemedi (broker kapalı olabilir):', err.message);
      });

      res.status(200).json({
        success: true,
        persisted,
        data: decision,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Chart.js / Frontend için geçmiş ham zaman serisi verilerini döner
   * GET /api/energy/metrics
   */
  public getMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit } = metricsQuerySchema.parse(req.query);
      const metrics = await this.timescaleService.getRecentMetrics(limit);
      res.status(200).json({ success: true, count: metrics.length, data: metrics });
    } catch (error) {
      next(error);
    }
  };

  /**
   * TimescaleDB time_bucket() özetlenmiş verilerini döner (Chart.js için optimize)
   * GET /api/energy/metrics/aggregated?interval=1 hour
   */
  public getAggregatedMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { interval } = aggregatedQuerySchema.parse(req.query);
      const aggregated = await this.timescaleService.getAggregatedMetrics(interval);
      res.status(200).json({ success: true, interval, data: aggregated });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 24 saatlik veya özel senaryolu Basic vs Smart karşılaştırmalı simülasyonu çalıştırır
   * POST /api/energy/run-scenario
   */
  public runScenarioSimulation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedConfig = runScenarioSchema.parse(req.body);

      const report = this.simulationRunner.runComparisonSimulation({
        scenarioName: validatedConfig.scenarioName || '24-Saatlik Kampüs Kesinti ve Fiyat Arbitrajı Simülasyonu',
        durationHours: validatedConfig.durationHours,
        gridOutageStartHour: validatedConfig.gridOutageStartHour,
        gridOutageDurationHours: validatedConfig.gridOutageDurationHours,
        cloudyDayFactor: validatedConfig.cloudyDayFactor,
        batteryCapacityKWh: validatedConfig.batteryCapacityKWh,
        initialBatteryKWh: validatedConfig.initialBatteryKWh,
        priceModel: validatedConfig.priceModel,
      });

      if (validatedConfig.saveToDatabase) {
        // Frontend kıyaslaması için her iki stratejinin kararları da kaydedilir
        const decisions = [...report.basicStrategyReport.decisions, ...report.smartStrategyReport.decisions];
        for (const dec of decisions) {
          await this.timescaleService.logEnergyMetrics(dec);
        }
      }

      res.status(200).json({
        success: true,
        report,
      });
    } catch (error) {
      next(error);
    }
  };
}
