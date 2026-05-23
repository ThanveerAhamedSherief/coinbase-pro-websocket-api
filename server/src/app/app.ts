import express, { Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { CoinbaseClient } from '../modules/coinbase/coinbase.client';
import type { UserManager } from '../modules/users/user.manager';

const httpLimiter = rateLimit({
  windowMs:       60_000,
  max:            60,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        { error: 'Too many requests' },
});

export function createApp(coinbase: CoinbaseClient, userManager: UserManager): express.Application {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: '4kb' }));
  app.use(httpLimiter);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status:             'ok',
      uptime:             process.uptime(),
      connectedUsers:     userManager.userCount,
      coinbaseConnected:  coinbase.connected,
      subscribedProducts: coinbase.subscribedProducts,
    });
  });

  return app;
}
