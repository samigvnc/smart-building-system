import './test-env';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SimulationInputService } from '../src/services/simulation-input.service';
import { SimulationService } from '../src/services/simulation.service';
import { SimulationEngineClient } from '../src/services/core-engine.client';
import {
  DayValues,
  SimulationDataRepository,
  SimulationRunsRepository,
} from '../src/repositories/simulation-data.repository';
import { simulationRunSchema, simulationEngineResponseSchema } from '../src/validators/simulation.validator';
import { BuildingType } from '../src/types/energy.types';
import {
  SimulationEngineRequest,
  SimulationEngineResponse,
  StrategyComparisonResult,
} from '../src/types/simulation-contract';
import { AppError } from '../src/middlewares/error.middleware';
import { parseCsv } from '../src/utils/csv';

const day = (fn: (h: number) => number): DayValues => Array.from({ length: 24 }, (_, h) => fn(h));

function fakeRepo(overrides: Partial<SimulationDataRepository> = {}): SimulationDataRepository {
  return {
    getDemandForDay: async () =>
      new Map<BuildingType, DayValues>([
        [BuildingType.LABORATORY, day(() => 10)],
        [BuildingType.LIBRARY, day(() => 5)],
        [BuildingType.DORMITORY, day((h) => 12 + h)],
        [BuildingType.CAFETERIA, day(() => 4)],
      ]),
    getSolarForDay: async () => day((h) => (h >= 6 && h <= 18 ? 20 : 0)),
    getPriceProfile: async () => day((h) => (h >= 17 ? 3 : 1.5)),
    findLatestCompleteDay: async () => '2026-01-01',
    ...overrides,
  };
}

const emptyStrategyResult = (name: string) => ({
  summary: {
    strategyName: name,
    totalCost: 1,
    gridUsageKwh: 1,
    solarUsageKwh: 1,
    batteryUsageKwh: 1,
    unservedEnergyKwh: 0,
    renewableUtilizationPercent: 50,
    finalBatterySocKwh: 10,
  },
  hourlyResults: [],
});
const cannedResult: StrategyComparisonResult = {
  basic: emptyStrategyResult('Basic Strategy'),
  smart: emptyStrategyResult('Smart Strategy'),
};

function fakeEngine(respond: (req: SimulationEngineRequest) => SimulationEngineResponse) {
  const calls: SimulationEngineRequest[] = [];
  const client: SimulationEngineClient = {
    run: async (req) => {
      calls.push(req);
      return respond(req);
    },
  };
  return { client, calls };
}

const memoryRuns = (): SimulationRunsRepository & { saved: number } => {
  const repo = {
    saved: 0,
    save: async () => {
      repo.saved++;
      return 'run-1';
    },
    findById: async () => null,
    list: async () => [],
  };
  return repo;
};

describe('SimulationInputService - DB verisinden 24 saatlik Core Engine girdisi', () => {
  it('24 saat, doğru bina listesi, kritik işaretleri ve toplam talep üretir', async () => {
    const svc = new SimulationInputService(fakeRepo());
    const { date, hourlyInputs } = await svc.buildInputs({
      criticalBuildings: [BuildingType.LABORATORY, BuildingType.LIBRARY],
    });

    assert.strictEqual(date, '2026-01-01');
    assert.strictEqual(hourlyInputs.length, 24);
    assert.deepStrictEqual(hourlyInputs.map((i) => i.hour), [...Array(24).keys()]);

    const h5 = hourlyInputs[5];
    assert.strictEqual(h5.buildingLoads.length, 4);
    assert.strictEqual(h5.demandKwh, 10 + 5 + 17 + 4); // lab + lib + dorm(12+5) + cafe
    assert.strictEqual(h5.buildingLoads.find((l) => l.buildingType === BuildingType.LABORATORY)?.critical, true);
    assert.strictEqual(h5.buildingLoads.find((l) => l.buildingType === BuildingType.LIBRARY)?.critical, true);
    assert.strictEqual(h5.buildingLoads.find((l) => l.buildingType === BuildingType.DORMITORY)?.critical, false);
    assert.strictEqual(h5.gridAvailable, true);
    assert.strictEqual(h5.gridPricePerKwh, 1.5);
    assert.strictEqual(hourlyInputs[12].solarGenerationKwh, 20);
  });

  it('Kritik bina yapılandırılabilir (yalnızca yemekhane kritik)', async () => {
    const { hourlyInputs } = await new SimulationInputService(fakeRepo()).buildInputs({
      criticalBuildings: [BuildingType.CAFETERIA],
    });
    const critical = hourlyInputs[0].buildingLoads.filter((l) => l.critical).map((l) => l.buildingType);
    assert.deepStrictEqual(critical, [BuildingType.CAFETERIA]);
  });

  it('Veri yoksa 422 AppError fırlatır', async () => {
    const svc = new SimulationInputService(fakeRepo({ findLatestCompleteDay: async () => null }));
    await assert.rejects(
      () => svc.buildInputs({ criticalBuildings: [] }),
      (e: any) => e instanceof AppError && e.statusCode === 422
    );
  });

  it('Eksik saatli bina verisi veya tarife reddedilir', async () => {
    const gappy = day((h) => h);
    (gappy as any)[7] = undefined;
    const badDemand = new SimulationInputService(
      fakeRepo({ getDemandForDay: async () => new Map([[BuildingType.LABORATORY, gappy]]) })
    );
    await assert.rejects(() => badDemand.buildInputs({ date: '2026-01-01', criticalBuildings: [] }), /eksik saatler/);

    const noPrice = new SimulationInputService(
      fakeRepo({ getPriceProfile: async () => new Array(24).fill(undefined) })
    );
    await assert.rejects(() => noPrice.buildInputs({ date: '2026-01-01', criticalBuildings: [] }), /tarife/i);
  });
});

describe('SimulationService - Core Engine\'e delege eder, mantığı tekrar etmez', () => {
  const params = () =>
    simulationRunSchema.parse({
      scenarioConditions: [{ type: 'GRID_OUTAGE', startHour: 18, endHour: 20 }],
    });

  it('İsteği ortak varsayılanlarla kurar, motora gönderir ve sonucu kaydeder', async () => {
    const engine = fakeEngine((req) => ({ taskId: req.taskId, status: 'OK', result: cannedResult }));
    const runs = memoryRuns();
    const svc = new SimulationService(new SimulationInputService(fakeRepo()), engine.client, runs);

    const outcome = await svc.run(params());

    assert.strictEqual(engine.calls.length, 1);
    const sent = engine.calls[0];
    assert.strictEqual(sent.hourlyInputs.length, 24);
    assert.strictEqual(sent.smartStrategyConfig.minimumReservePercent, 25);
    assert.strictEqual(sent.smartStrategyConfig.highPriceThreshold, 2.5);
    assert.strictEqual(sent.smartStrategyConfig.outageLookAheadHours, 3);
    assert.deepStrictEqual(sent.criticalBuildings, [BuildingType.LABORATORY]);
    assert.strictEqual(sent.initialBatterySocKwh, sent.batteryCapacityKwh / 2);
    assert.strictEqual(sent.scenarioConditions[0].type, 'GRID_OUTAGE');

    assert.strictEqual(outcome.runId, 'run-1');
    assert.strictEqual(runs.saved, 1);
    assert.strictEqual(outcome.result.smart.summary.strategyName, 'Smart Strategy');
    assert.ok(!('hourlyInputs' in outcome.request), 'yanıtta devasa girdi dizisi yer almamalı');
  });

  it('Motor ERROR dönerse 422, taskId uyuşmazsa 502 verir', async () => {
    const errEngine = fakeEngine((req) => ({ taskId: req.taskId, status: 'ERROR', errorMessage: 'kötü istek' }));
    await assert.rejects(
      () => new SimulationService(new SimulationInputService(fakeRepo()), errEngine.client, memoryRuns()).run(params()),
      (e: any) => e instanceof AppError && e.statusCode === 422 && /kötü istek/.test(e.message)
    );

    const wrongId = fakeEngine(() => ({ taskId: 'baska', status: 'OK', result: cannedResult }));
    await assert.rejects(
      () => new SimulationService(new SimulationInputService(fakeRepo()), wrongId.client, memoryRuns()).run(params()),
      (e: any) => e instanceof AppError && e.statusCode === 502
    );
  });
});

describe('Doğrulayıcılar ve yardımcılar', () => {
  it('Gövde boşken ortak varsayılanlar uygulanır', () => {
    const p = simulationRunSchema.parse({});
    assert.deepStrictEqual(p.criticalBuildings, [BuildingType.LABORATORY]);
    assert.strictEqual(p.smartStrategyConfig.minimumReservePercent, 25);
    assert.deepStrictEqual(p.scenarioConditions, []);
  });

  it('Geçersiz senaryo ve başlangıç bataryası reddedilir', () => {
    assert.throws(() =>
      simulationRunSchema.parse({ scenarioConditions: [{ type: 'GRID_OUTAGE', startHour: 20, endHour: 18 }] })
    );
    assert.throws(() =>
      simulationRunSchema.parse({ scenarioConditions: [{ type: 'CLOUDY_DAY', startHour: 8, endHour: 12, factor: 2 }] })
    );
    assert.throws(() =>
      simulationRunSchema.parse({ scenarioConditions: [{ type: 'DEMAND_SPIKE', startHour: 8, endHour: 12, factor: 0.5 }] })
    );
    assert.throws(() => simulationRunSchema.parse({ batteryCapacityKwh: 50, initialBatterySocKwh: 80 }));
    assert.throws(() => simulationRunSchema.parse({ criticalBuildings: ['HOSPITAL'] }));
    assert.throws(() => simulationRunSchema.parse({ date: '2026-13-45' }));
  });

  it('Core Engine yanıt şeması Java çıktısına uyan yanıtı kabul, bozuğu reddeder', () => {
    assert.ok(simulationEngineResponseSchema.safeParse({ taskId: 't', status: 'OK', result: cannedResult }).success);
    assert.ok(simulationEngineResponseSchema.safeParse({ taskId: 't', status: 'ERROR', errorMessage: 'x' }).success);
    assert.ok(!simulationEngineResponseSchema.safeParse({ taskId: 't', status: 'OK', result: { basic: {} } }).success);
  });

  it('CSV okuyucu başlıklı dosyayı okur, bozuk satırı reddeder', () => {
    assert.deepStrictEqual(parseCsv('hour,value\r\n0,5\r\n1,6\r\n'), [
      { hour: '0', value: '5' },
      { hour: '1', value: '6' },
    ]);
    assert.throws(() => parseCsv('a,b\n1'));
  });
});
