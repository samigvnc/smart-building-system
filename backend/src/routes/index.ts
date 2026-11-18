import { Router } from 'express';
import simulationRoutes from './simulation.routes';

const rootRouter = Router();

rootRouter.use('/simulation', simulationRoutes);

rootRouter.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', uptime: process.uptime(), timestamp: new Date() });
});

export default rootRouter;
