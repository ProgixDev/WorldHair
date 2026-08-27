import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('produces a bcrypt hash that is not the plaintext', async () => {
    const hash = await service.hash('correct horse battery');

    expect(hash).not.toBe('correct horse battery');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('verifies a matching password', async () => {
    const hash = await service.hash('correct horse battery');

    await expect(service.compare('correct horse battery', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('correct horse battery');

    await expect(service.compare('wrong horse', hash)).resolves.toBe(false);
  });
});
