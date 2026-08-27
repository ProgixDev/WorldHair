import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Tests inject env directly; never let a developer's .env leak into them.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
  ],
})
export class ConfigModule {}
