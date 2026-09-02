import {
  Injectable,
  StreamableFile,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  SuccessEnvelope<T> | StreamableFile
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessEnvelope<T> | StreamableFile> {
    return next
      .handle()
      .pipe(
        map((data) =>
          data instanceof StreamableFile ? data : { success: true, data },
        ),
      );
  }
}
