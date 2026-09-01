import { IsIn, IsOptional, IsString } from 'class-validator';

export type AccountRole = 'particulier' | 'coiffeur';
export type AccountStatus = 'active' | 'suspended' | 'banned';

export interface AdminAccountDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: AccountRole;
  accountStatus: AccountStatus;
  createdAt: string;
}

export class ListAccountsQueryDto {
  @IsOptional()
  @IsIn(['particulier', 'coiffeur'])
  role?: AccountRole;

  @IsOptional()
  @IsString()
  search?: string;
}

export class SetAccountStatusDto {
  @IsIn(['active', 'suspended', 'banned'])
  status!: AccountStatus;
}
