import { Router } from 'express';
import { SimulationController } from '../controllers/simulation.controller';

const router = Router();
const controller = new SimulationController();

router.get('/defaults', controller.getDefaults);
router.get('/inputs', controller.getInputs);
router.post('/run', controller.run);
router.get('/runs', controller.listRuns);
router.get('/runs/:id', controller.getRun);

export default router;
