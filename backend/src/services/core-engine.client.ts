import { ENV } from '../config/env';
import { AppError } from '../middlewares/error.middleware';
import { RabbitMQService } from '../message-brokers/rabbitmq.service';
import { SimulationEngineRequest, SimulationEngineResponse } from '../types/simulation-contract';
import { simulationEngineResponseSchema } from '../validators/simulation.validator';

/** Simülasyon motoruna (Java Core Engine) erişim soyutlaması. */
export interface SimulationEngineClient {
  run(request: SimulationEngineRequest): Promise<SimulationEngineResponse>;
}

/**
 * Core Engine ile RabbitMQ üzerinden istek-yanıt (RPC) haberleşmesi:
 * istek `core_engine_queue`ya gider, yanıt `replyTo` ile aynı `correlationId` üzerinden döner.
 */
export class RabbitMqSimulationEngineClient implements SimulationEngineClient {
  constructor(
    private readonly broker: RabbitMQService = RabbitMQService.getInstance(),
    private readonly timeoutMs: number = ENV.SIMULATION.CORE_ENGINE_TIMEOUT_MS
  ) {}

  public async run(request: SimulationEngineRequest): Promise<SimulationEngineResponse> {
    if (!this.broker.isConnected()) {
      throw new AppError('RabbitMQ bağlantısı yok; simülasyon motoruna ulaşılamıyor.', 503);
    }

    let raw: unknown;
    try {
      raw = await this.broker.request(ENV.RABBITMQ.CORE_ENGINE_QUEUE, request, this.timeoutMs);
    } catch (err: any) {
      throw new AppError(
        'Core Engine (simülasyon motoru) yanıt vermedi. Servis çalışıyor ve core_engine_queue\'yu dinliyor mu?',
        504,
        { reason: err?.message }
      );
    }

    const parsed = simulationEngineResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('Core Engine beklenmeyen biçimde yanıt verdi (sözleşme uyuşmazlığı).', 502, {
        issues: parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return parsed.data as SimulationEngineResponse;
  }
}
