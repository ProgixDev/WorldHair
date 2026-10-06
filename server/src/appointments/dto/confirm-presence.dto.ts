import { IsString, Length } from 'class-validator';

/** The code in the QR the salon shows. */
export class ConfirmPresenceDto {
  @IsString()
  @Length(12, 12)
  code!: string;
}
