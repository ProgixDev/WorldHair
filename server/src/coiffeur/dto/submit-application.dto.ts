import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
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

/** Tolerant of spaces, dots, dashes and +33 — same shape as the mobile app's own validator. */
const PHONE_FR_PATTERN = /^(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
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

  @IsString()
  @Matches(PHONE_FR_PATTERN, { message: 'phone must be a valid French phone number' })
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
