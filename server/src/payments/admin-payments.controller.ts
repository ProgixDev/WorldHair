import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { RefundAppointmentDto } from '../appointments/dto/refund-appointment.dto';
import { AdminPaymentSummary, PaymentsService } from './payments.service';

/** `/admin/paiements`: every payment, and the refund of last resort for disputes — even after the salon was paid. */
@Roles('admin', 'admin_limited')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(): Promise<AdminPaymentSummary[]> {
    return this.payments.listForAdmin();
  }

  @Post(':appointmentId/refund')
  @HttpCode(200)
  async refund(
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() dto: RefundAppointmentDto,
  ): Promise<{ refunded: number }> {
    return { refunded: await this.payments.refund(appointmentId, { amount: dto.amount, reason: 'admin' }) };
  }
}
