import { AdPlacementId, AdSlot } from '../ad-slots.service';

export class AdSlotDto {
  id!: AdPlacementId;
  active!: boolean;
  headline!: string;
  imageUrl!: string | null;
  linkUrl!: string | null;
  updatedAt!: string;
}

export function toAdSlotDto(slot: AdSlot): AdSlotDto {
  return { ...slot };
}
