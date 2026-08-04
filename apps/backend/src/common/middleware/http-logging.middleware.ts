import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HttpLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HttpLoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const startMs = Date.now();

    // Inbound: JwtAuthGuard runs AFTER middleware, so req.user is not yet populated here.
    this.logger.log(`→  ${method} ${originalUrl}`);

    res.on('finish', () => {
      const duration = Date.now() - startMs;
      const { statusCode } = res;
      // Resolve the user lazily — by response time the guard has populated req.user.
      const userId = (req as Request & { user?: { id?: string } }).user?.id ?? 'anon';
      const line = `←  ${method} ${originalUrl} [user:${userId}] ${statusCode} ${duration}ms`;

      if (statusCode >= 500) {
        this.logger.error(line);
      } else {
        this.logger.log(line);
      }
    });

    next();
  }
}
