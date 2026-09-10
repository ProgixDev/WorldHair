import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { EnvironmentVariables, NodeEnv } from '../config/env.validation';
import { DevOtpController } from './dev-otp.controller';
import { DevOtpStore } from './dev-otp.store';

function configFor(nodeEnv: NodeEnv): ConfigService<EnvironmentVariables, true> {
  return { get: () => nodeEnv } as unknown as ConfigService<EnvironmentVariables, true>;
}

describe('DevOtpController', () => {
  it('returns a stashed code, case-insensitively, in development', () => {
    const config = configFor(NodeEnv.Development);
    const store = new DevOtpStore(config);
    store.set('Camille@Example.com', '112233');
    const controller = new DevOtpController(store, config);

    expect(controller.lastOtp('camille@example.com')).toEqual({ token: '112233' });
  });

  it('returns null when nothing has been stashed for that email yet', () => {
    const config = configFor(NodeEnv.Development);
    const controller = new DevOtpController(new DevOtpStore(config), config);

    expect(controller.lastOtp('nobody@example.com')).toEqual({ token: null });
  });

  it('returns null with no email given, rather than throwing', () => {
    const config = configFor(NodeEnv.Development);
    const controller = new DevOtpController(new DevOtpStore(config), config);

    expect(controller.lastOtp(undefined)).toEqual({ token: null });
  });

  it('404s outright in production — the route looks like it does not exist, not just empty', () => {
    const config = configFor(NodeEnv.Production);
    const store = new DevOtpStore(config);
    const controller = new DevOtpController(store, config);

    expect(() => controller.lastOtp('camille@example.com')).toThrow(NotFoundException);
  });
});

describe('DevOtpStore', () => {
  it('is a one-time reveal — a second take() for the same email returns null', () => {
    const store = new DevOtpStore(configFor(NodeEnv.Development));
    store.set('camille@example.com', '112233');

    expect(store.take('camille@example.com')).toBe('112233');
    expect(store.take('camille@example.com')).toBeNull();
  });

  it('expires an entry after its TTL', () => {
    jest.useFakeTimers();
    try {
      const store = new DevOtpStore(configFor(NodeEnv.Development));
      store.set('camille@example.com', '112233');

      jest.advanceTimersByTime(10 * 60_000 + 1);

      expect(store.take('camille@example.com')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('never stores anything in production', () => {
    const store = new DevOtpStore(configFor(NodeEnv.Production));
    store.set('camille@example.com', '112233');

    expect(store.take('camille@example.com')).toBeNull();
  });
});
