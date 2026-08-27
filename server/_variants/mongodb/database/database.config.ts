import { ConfigService } from '@nestjs/config';
import { MongooseModuleOptions } from '@nestjs/mongoose';

export function mongooseConfigFactory(configService: ConfigService): MongooseModuleOptions {
  return {
    uri: configService.getOrThrow<string>('MONGODB_URI'),
  };
}
