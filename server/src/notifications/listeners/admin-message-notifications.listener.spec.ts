import { FakeSupabaseService } from '../../../test/utils/fakes/fake-supabase.service';
import { SupabaseService } from '../../database/supabase.service';
import { NotificationsService } from '../notifications.service';
import { PushService } from '../push.service';
import { PushTokensService } from '../push-tokens.service';
import { AdminMessageNotificationsListener } from './admin-message-notifications.listener';

class FakePushService {
  send: PushService['send'] = async (messages) => messages.map((m) => ({ token: m.token, ok: true }));
}

const COIFFEUR_ID = 'coiffeur-1';

describe('AdminMessageNotificationsListener', () => {
  let supabase: FakeSupabaseService;
  let listener: AdminMessageNotificationsListener;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    supabase.addUser('token', { id: COIFFEUR_ID, email: 'sofia@example.com', email_confirmed_at: null }, 'coiffeur');

    const pushTokens = new PushTokensService(supabase as unknown as SupabaseService);
    const notifications = new NotificationsService(
      supabase as unknown as SupabaseService,
      pushTokens,
      new FakePushService() as unknown as PushService,
    );
    listener = new AdminMessageNotificationsListener(notifications);
  });

  it('pushes the message body as the notification body', async () => {
    await listener.onSent({ messageId: 'msg-1', coiffeurId: COIFFEUR_ID, body: 'Dernier avertissement.' });

    expect(supabase.notifyLogFor(COIFFEUR_ID)).toMatchObject([
      { type: 'admin_message', dedupe_key: 'msg-1', body: 'Dernier avertissement.' },
    ]);
  });

  it('a later message with a different id notifies again', async () => {
    await listener.onSent({ messageId: 'msg-1', coiffeurId: COIFFEUR_ID, body: 'Premier message.' });
    await listener.onSent({ messageId: 'msg-2', coiffeurId: COIFFEUR_ID, body: 'Deuxième message.' });

    expect(supabase.notifyLogFor(COIFFEUR_ID)).toHaveLength(2);
  });

  it('does not throw when the coiffeur has no resolvable profile', async () => {
    await expect(
      listener.onSent({ messageId: 'msg-1', coiffeurId: 'unknown-coiffeur', body: 'x' }),
    ).resolves.toBeUndefined();
  });
});
