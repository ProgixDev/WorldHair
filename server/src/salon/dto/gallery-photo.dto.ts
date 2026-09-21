import { IsString } from 'class-validator';

export class AddGalleryPhotoDto {
  /** A user-photos Storage public URL — same field mobile writes after uploading. */
  @IsString()
  url!: string;

  /** The matching Storage object path, so the client can remove it on delete. */
  @IsString()
  storagePath!: string;
}
