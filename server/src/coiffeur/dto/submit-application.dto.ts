import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum PracticeZone {
  Salon = 'salon',
  Domicile = 'domicile',
}

const POSTAL_CODE_FR_PATTERN = /^\d{5}$/;

/**
 * Body for `POST /coiffeur/applications`. `identityDocumentPath`,
 * `diplomaDocumentPath` and `kbisDocumentPath` are always required;
 * `invoiceDocumentPath` only when `practiceZone` is `salon` — the client
 * uploads the actual files straight to Supabase Storage first (see
 * `coiffeur-applications.service.ts`) and only sends the resulting paths here.
 */
export class SubmitCoiffeurApplicationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName!: string;

  // No region argument: the mobile app's own country picker (issue: phone
  // country code selection) always sends a full E.164 number — "+" plus the
  // calling code — so there's an intl. calling code to validate against
  // regardless of which country the applicant picked. This used to be
  // French-only.
  @IsPhoneNumber()
  phone!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  salonName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsEnum(PracticeZone)
  practiceZone!: PracticeZone;

  @ValidateIf((dto: SubmitCoiffeurApplicationDto) => dto.practiceZone === PracticeZone.Salon)
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  addressLine?: string;

  @ValidateIf((dto: SubmitCoiffeurApplicationDto) => dto.practiceZone === PracticeZone.Salon)
  @Matches(POSTAL_CODE_FR_PATTERN, { message: 'postalCode must be 5 digits' })
  postalCode?: string;

  @ValidateIf((dto: SubmitCoiffeurApplicationDto) => dto.practiceZone === PracticeZone.Salon)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city?: string;

  @ValidateIf((dto: SubmitCoiffeurApplicationDto) => dto.practiceZone === PracticeZone.Salon)
  @IsString()
  invoiceDocumentPath?: string;

  @ValidateIf((dto: SubmitCoiffeurApplicationDto) => dto.practiceZone === PracticeZone.Domicile)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  travelRadiusKm?: number;

  @IsString()
  identityDocumentPath!: string;

  @IsString()
  diplomaDocumentPath!: string;

  @IsString()
  kbisDocumentPath!: string;
}
