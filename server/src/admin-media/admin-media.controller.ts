import {
  BadRequestException,
  Controller,
  InternalServerErrorException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { Roles } from '../common/decorators/roles.decorator';
import { SupabaseService } from '../database/supabase.service';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Uploads an image to the `admin-media` bucket through the service-role
 * client (ad-slots/content image pickers — `web/src/app/(admin)/admin/
 * publicites/`, `.../contenu/`), rather than straight from the browser.
 * Direct-from-browser would work too now (see schema.sql's admin-media
 * SELECT policy — that was the real, missing piece), but this also gets
 * server-side size/mimetype validation for free.
 */
@Roles('admin', 'admin_limited')
@Controller('admin/media')
export class AdminMediaController {
  constructor(private readonly supabase: SupabaseService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new BadRequestException('Only image uploads are allowed.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }

    const extension = file.originalname.split('.').pop() ?? 'bin';
    const path = `uploads/${randomUUID()}.${extension}`;

    const { error } = await this.supabase.client.storage
      .from('admin-media')
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const { data } = this.supabase.client.storage.from('admin-media').getPublicUrl(path);
    return { url: data.publicUrl };
  }
}
