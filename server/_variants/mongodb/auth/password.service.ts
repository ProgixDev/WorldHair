import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';

const SALT_ROUNDS = 12;

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return hash(plain, SALT_ROUNDS);
  }

  compare(plain: string, hashed: string): Promise<boolean> {
    return compare(plain, hashed);
  }
}
