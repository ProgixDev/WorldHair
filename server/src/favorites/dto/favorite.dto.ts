import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional, IsUUID } from 'class-validator';

export class AddFavoriteDto {
  @IsUUID()
  coiffeurId!: string;
}

/** Where the client is, for the distances on their favorites' cards. */
export class ListFavoritesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;
}
