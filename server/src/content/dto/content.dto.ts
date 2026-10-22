import { AppContent } from '../content.service';

export class AppContentDto {
  key!: string;
  heading!: string;
  body!: string;
  imageUrl!: string | null;
  buttonLabel!: string;
  updatedAt!: string;
}

export function toAppContentDto(content: AppContent): AppContentDto {
  return { ...content };
}
