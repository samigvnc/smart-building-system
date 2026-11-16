import { Router } from 'express';
import { EnergyController } from '../controllers/energy.controller';

const router = Router();
const controller = new EnergyController();

router.post('/simulate-step', controller.simulateStep);
router.post('/run-scenario', controller.runScenarioSimulation);
router.get('/metrics', controller.getMetrics);
router.get('/metrics/aggregated', controller.getAggregatedMetrics);

export default router;

