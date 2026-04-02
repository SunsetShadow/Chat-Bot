import { Injectable, NestMiddleware, HttpStatus, HttpException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private store = new Map<string, RateLimitEntry>();
  private windowMs = 60000;
  protected maxRequests = 30;

  use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = this.store.get(ip);

    if (!entry || now > entry.resetTime) {
      this.store.set(ip, { count: 1, resetTime: now + this.windowMs });
      next();
      return;
    }

    if (entry.count >= this.maxRequests) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    entry.count++;
    next();
  }
}

@Injectable()
export class ChatRateLimitMiddleware extends RateLimitMiddleware {
  maxRequests = 20;
}

@Injectable()
export class MemoryRateLimitMiddleware extends RateLimitMiddleware {
  maxRequests = 60;
}
