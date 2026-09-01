import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ContentService } from './content.service';
import { AppContentDto, toAppContentDto } from './dto/content.dto';

/**
 * What `mobile/src/services/content.ts` will call once wired to the real
 * API. `@Public()`: the onboarding carousel this feeds runs before signup —
 * there is no authenticated user yet.
 */
@Public()
@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get(':key')
  async get(@Param('key') key: string): Promise<AppContentDto> {
    return toAppContentDto(await this.content.get(key));
  }
}
