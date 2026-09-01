import { Module } from '@nestjs/common';
import { AdminAccountsController } from './admin-accounts.controller';
import { AdminAccountsService } from './admin-accounts.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// No explicit SupabaseService import needed — DatabaseModule is @Global().
@Module({
  controllers: [UsersController, AdminAccountsController],
  providers: [UsersService, AdminAccountsService],
  exports: [UsersService],
})
export class UsersModule {}
