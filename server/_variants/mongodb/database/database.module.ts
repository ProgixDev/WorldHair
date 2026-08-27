import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { mongooseConfigFactory } from './database.config';

/**
 * Connects to MongoDB via `MONGODB_URI` — a MongoDB Atlas connection string in
 * production, or any reachable MongoDB instance in dev. No local Mongo/Docker
 * setup is provided or expected; Atlas's free tier is the intended dev
 * environment (e2e tests use `mongodb-memory-server` instead, see `test/`).
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: mongooseConfigFactory,
    }),
  ],
})
export class DatabaseModule {}
