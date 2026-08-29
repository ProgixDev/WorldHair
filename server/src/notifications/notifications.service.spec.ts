import { SupabaseService } from '../database/supabase.service';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { NotificationsService } from './notifications.service';
import { PushSendResult, PushService } from './push.service';
import { PushTokensService } from './push-tokens.service';

/** Never calls real Expo infra — NotificationsService only needs PushService's shape. */
class FakePushService {
  results: PushSendResult[] = [];
  calls: Parameters<PushService['send']>[0][] = [];

  send: PushService['send'] = async (messages) => {
    this.calls.push(messages);
    return this.results.length > 0 ? this.results : messages.map((m) => ({ token: m.token, ok: true }));
  };
}

const USER_ID = 'user-1';

describe('NotificationsService', () => {
  let supabase: FakeSupabaseService;
  let pushTokens: PushTokensService;
  let push: FakePushService;
  let service: NotificationsService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    pushTokens = new PushTokensService(supabase as unknown as SupabaseService);
    push = new FakePushService();
    service = new NotificationsService(supabase as unknown as SupabaseService, pushTokens, push as unknown as PushService);
  });

  describe('preferences', () => {
    it('defaults both reminders to enabled before anything is saved', async () => {
      await expect(service.getPreferences(USER_ID)).resolves.toEqual({
        reminderDayBefore: true,
        reminderHourBefore: true,
      });
    });

    it('updates only the given field, persists it, and returns it on the next read', async () => {
      const updated = await service.updatePreferences(USER_ID, { reminderDayBefore: false });
      expect(updated).toEqual({ reminderDayBefore: false, reminderHourBefore: true });
      await expect(service.getPreferences(USER_ID)).resolves.toEqual(updated);
    });
  });

  describe('notifyUser', () => {
    it('records the notification and pushes to every active token', async () => {
      await pushTokens.register(USER_ID, 'token-a', 'ios');
      await pushTokens.register(USER_ID, 'token-b', 'android');

      const sent = await service.notifyUser({
        userId: USER_ID,
        type: 'appointment_created',
        dedupeKey: 'apt-1',
        title: 'Nouvelle demande',
        body: 'Nouvelle demande pour Coupe.',
      });

      expect(sent).toBe(true);
      expect(push.calls).toHaveLength(1);
      expect(push.calls[0].map((m) => m.token).sort()).toEqual(['token-a', 'token-b']);
    });

    it('is a no-op the second time for the same (user, type, dedupeKey)', async () => {
      await pushTokens.register(USER_ID, 'token-a', 'ios');
      const params = {
        userId: USER_ID,
        type: 'appointment_created',
        dedupeKey: 'apt-1',
        title: 'Nouvelle demande',
        body: 'Nouvelle demande pour Coupe.',
      };
      await expect(service.notifyUser(params)).resolves.toBe(true);
      await expect(service.notifyUser(params)).resolves.toBe(false);
      expect(push.calls).toHaveLength(1); // second call never reached the push step
    });

    it('the same dedupeKey under a different type still notifies (J-1 vs H-1 on the same appointment)', async () => {
      await pushTokens.register(USER_ID, 'token-a', 'ios');
      await expect(
        service.notifyUser({ userId: USER_ID, type: 'appointment_reminder_j1', dedupeKey: 'apt-1', title: 't', body: 'b' }),
      ).resolves.toBe(true);
      await expect(
        service.notifyUser({ userId: USER_ID, type: 'appointment_reminder_h1', dedupeKey: 'apt-1', title: 't', body: 'b' }),
      ).resolves.toBe(true);
    });

    it('invalidates a token Expo reports as DeviceNotRegistered', async () => {
      await pushTokens.register(USER_ID, 'token-a', 'ios');
      push.results = [{ token: 'token-a', ok: false, error: 'DeviceNotRegistered' }];

      await service.notifyUser({ userId: USER_ID, type: 'appointment_created', dedupeKey: 'apt-1', title: 't', body: 'b' });

      await expect(pushTokens.listActiveForUser(USER_ID)).resolves.toEqual([]);
    });

    it('still records the notification when the user has no active push tokens', async () => {
      const sent = await service.notifyUser({
        userId: USER_ID,
        type: 'appointment_created',
        dedupeKey: 'apt-1',
        title: 't',
        body: 'b',
      });
      expect(sent).toBe(true);
      expect(push.calls).toHaveLength(0);
    });
  });
});
