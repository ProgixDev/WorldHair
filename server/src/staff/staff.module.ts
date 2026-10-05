import { Module } from '@nestjs/common';
import { SalonStaffController } from './salon-staff.controller';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

// No explicit SupabaseService import needed — DatabaseModule is @Global().
@Module({
  controllers: [SalonStaffController, StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
