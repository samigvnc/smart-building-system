import express, { Application } from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';

export function createApp(): Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // API Rotaları
  app.use('/api', routes);

  // Global Hata Yakalama Middleware'i
  app.use(errorHandler);

  return app;
}

