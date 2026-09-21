import {
  IsArray,
  IsIn,
  IsISO31661Alpha2,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/** Mirrors the `coiffeur_profiles`/`coiffeur_services` check constraints in schema.sql. */
export const SPECIALTIES = ['coupe', 'coloration', 'afro', 'tresses', 'barbier', 'soins', 'mariage'] as const;
export type Specialty = (typeof SPECIALTIES)[number];

export class UpdateSalonProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  salonName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine?: string;

  // Unlike the other optional fields, an empty string isn't "not provided"
  // to a plain @IsOptional() — that only skips null/undefined, so a blank
  // postal code (the editor has no required-field marker on it) still hit
  // the format check and 400'd the whole save. @ValidateIf treats falsy the
  // same as missing.
  @ValidateIf((dto: UpdateSalonProfileDto) => Boolean(dto.postalCode))
  @Matches(/^\d{5}$/, { message: 'postalCode must be 5 digits' })
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  // Deliberately NOT @IsPhoneNumber() (unlike SubmitCoiffeurApplicationDto's
  // signup phone): that validates against formal per-country numbering-plan
  // assignment tables, which reject real working numbers outside them (VOIP,
  // newer allocations, etc. — confirmed against a real one during testing).
  // Signup's stricter check makes sense there (an admin needs to reach the
  // applicant to verify identity); this is just a public contact number on
  // the coiffeur's own profile — only the E.164 *shape* is worth enforcing.
  // @ValidateIf, not @IsOptional: this editor's phone field has no
  // required-field marker, so a blank string must be accepted the same way
  // postalCode's blank case is above, not treated as "provided but invalid".
  @ValidateIf((dto: UpdateSalonProfileDto) => Boolean(dto.phone))
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be a valid E.164 number' })
  phone?: string;

  /** The country picked for `phone` — kept because the E.164 number alone can't say which one (a calling code can be shared). */
  @IsOptional()
  @IsISO31661Alpha2()
  phoneCountry?: string;

  @IsOptional()
  @IsArray()
  @IsIn(SPECIALTIES, { each: true })
  specialties?: Specialty[];

  /** A user-photos Storage public URL — same field mobile writes after uploading the cover. */
  @IsOptional()
  @IsString()
  coverUrl?: string;

  /** The address's coordinates — feeds public search (see src/discovery/). Not auto-geocoded from addressLine yet. */
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
}
