import { Controller, Post, RawBodyRequest, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { EmailHookService } from './email-hook.service';

/**
 * Receives Supabase's "Send Email" Auth Hook — see EmailHookService's doc
 * comment. `@Public()`: the caller is Supabase's own infra, not one of this
 * app's users, so it carries no bearer token; the Standard Webhooks
 * signature (verified inside EmailHookService) is the actual gate here, not
 * JwtAuthGuard.
 */
@Public()
@Controller('auth')
export class EmailHookController {
  constructor(private readonly emailHook: EmailHookService) {}

  @Post('email-hook')
  async handle(@Req() req: RawBodyRequest<Request>): Promise<{ received: true }> {
    // rawBody (see main.ts's NestFactory.create(..., { rawBody: true })) is
    // the exact bytes Supabase sent — signature verification needs those,
    // not a re-serialized copy of the parsed body, which can byte-for-byte
    // differ and fail every check.
    const payload = this.emailHook.verifyAndParse(req.rawBody ?? Buffer.from(''), {
      'webhook-id': stringHeader(req.headers['webhook-id']),
      'webhook-timestamp': stringHeader(req.headers['webhook-timestamp']),
      'webhook-signature': stringHeader(req.headers['webhook-signature']),
    });

    await this.emailHook.dispatch(payload);

    return { received: true };
  }
}

function stringHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
