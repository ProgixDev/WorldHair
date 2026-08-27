import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Narrow structural types for the bits of express's Request/Response this
 * filter touches. Avoids adding @types/express as a project dependency
 * purely for two property/method shapes.
 */
interface HttpResponseLike {
  status(code: number): { json(body: ErrorResponseBody): unknown };
}

interface HttpRequestLike {
  url: string;
  method: string;
}

/**
 * Normalizes every thrown error into one JSON shape. Wire this in globally
 * (see `bootstrap.ts`) so clients never have to special-case a bare 500 vs an
 * `HttpException`.
 *
 * Deliberately has no external error-reporting call (Sentry, etc.) — the
 * unhandled branch below only logs. Wire in a reporting SDK here if the
 * project needs one.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponseLike>();
    const request = ctx.getRequest<HttpRequestLike>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        message = payload;
        error = exception.name.replace(/Exception$/, '');
      } else {
        const record = payload as { message?: string | string[]; error?: string };
        message = record.message ?? exception.message;
        error = record.error ?? exception.name.replace(/Exception$/, '');
      }
    } else {
      // Never leak internals of an unexpected failure to the client.
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      statusCode,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }
}
