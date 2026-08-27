import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

/**
 * Validates that a route param looks like a Mongo ObjectId before it reaches
 * the service layer. Without this, an invalid id flows straight into a
 * Mongoose query and Mongoose throws a `CastError` — not an `HttpException` —
 * which `AllExceptionsFilter` maps to a 500, indistinguishable from a real
 * server bug even though it's plain client input error.
 *
 * Returns the value unchanged (as a string) rather than converting it to a
 * `Types.ObjectId` — services in this codebase already accept string ids.
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }
    return value;
  }
}
