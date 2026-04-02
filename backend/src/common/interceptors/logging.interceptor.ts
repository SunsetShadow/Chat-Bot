import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();
    let error: any;

    return next.handle().pipe(
      tap({
        error: (err) => { error = err; },
      }),
      finalize(() => {
        const response = context.switchToHttp().getResponse();
        const status = response?.statusCode;
        const duration = Date.now() - now;
        if (error) {
          this.logger.error(`${method} ${url} ${status || 'ERR'} - ${duration}ms - ${error.message}`);
        } else {
          this.logger.log(`${method} ${url} ${status} - ${duration}ms`);
        }
      }),
    );
  }
}
