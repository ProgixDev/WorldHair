import { EventEmitter2 } from '@nestjs/event-emitter';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { SupabaseService } from '../database/supabase.service';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  let supabase: FakeSupabaseService;
  let events: EventEmitter2;
  let service: MessagesService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    events = new EventEmitter2();
    service = new MessagesService(supabase as unknown as SupabaseService, events);

    supabase.addUser('token-coiffeur', { id: 'coiffeur-1', email: 'sofia@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' }, 'coiffeur', {
      firstName: 'Sofia',
      lastName: 'Benali',
    });
    supabase.addUser('token-coiffeur-2', { id: 'coiffeur-2', email: 'camille@example.com', email_confirmed_at: '2024-01-01T00:00:00Z' }, 'coiffeur', {
      firstName: 'Camille',
      lastName: 'Durand',
    });
    supabase.addUser('token-admin', { id: 'admin-1', email: 'admin@worldhair.app', email_confirmed_at: '2024-01-01T00:00:00Z' }, 'admin', {
      firstName: 'Admin',
      lastName: 'WorldHair',
    });
  });

  it('listThreadsForAdmin() returns one row per coiffeur, with no messages yet', async () => {
    const threads = await service.listThreadsForAdmin();

    expect(threads).toHaveLength(2);
    expect(threads.find((t) => t.coiffeurId === 'coiffeur-1')).toMatchObject({
      firstName: 'Sofia',
      lastName: 'Benali',
      lastMessage: null,
      lastMessageAt: null,
      unreadForAdmin: 0,
    });
  });

  it('sendAsAdmin() then sendAsCoiffeur() build a thread visible from both sides', async () => {
    await service.sendAsAdmin('admin-1', 'coiffeur-1', 'Un client se plaint de votre retard récurrent.');
    await service.sendAsCoiffeur('coiffeur-1', "Désolé, je vais m'organiser.");

    const adminView = await service.getThreadForAdmin('coiffeur-1');
    expect(adminView.map((m) => m.body)).toEqual([
      'Un client se plaint de votre retard récurrent.',
      "Désolé, je vais m'organiser.",
    ]);

    const coiffeurView = await service.getMine('coiffeur-1');
    expect(coiffeurView.map((m) => m.body)).toEqual(adminView.map((m) => m.body));
  });

  it('listThreadsForAdmin() surfaces the last message and an unread-for-admin count', async () => {
    await service.sendAsCoiffeur('coiffeur-1', 'Bonjour, une question sur mon dossier.');
    await service.sendAsCoiffeur('coiffeur-1', 'Toujours en attente ?');

    const threads = await service.listThreadsForAdmin();
    const thread = threads.find((t) => t.coiffeurId === 'coiffeur-1');
    expect(thread).toMatchObject({ lastMessage: 'Toujours en attente ?', unreadForAdmin: 2 });
  });

  it('getThreadForAdmin() marks the coiffeur-sent messages as read', async () => {
    await service.sendAsCoiffeur('coiffeur-1', 'Bonjour ?');
    await service.getThreadForAdmin('coiffeur-1');

    const threads = await service.listThreadsForAdmin();
    expect(threads.find((t) => t.coiffeurId === 'coiffeur-1')).toMatchObject({ unreadForAdmin: 0 });
  });

  it('getMine() marks the admin-sent messages as read', async () => {
    await service.sendAsAdmin('admin-1', 'coiffeur-1', "Merci de compléter votre dossier.");

    const messages = await service.getMine('coiffeur-1');

    expect(messages[0].readAt).not.toBeNull();
  });

  it('a message thread never leaks into another coiffeur’s thread', async () => {
    await service.sendAsCoiffeur('coiffeur-1', 'Message de Sofia');
    await service.sendAsCoiffeur('coiffeur-2', 'Message de Camille');

    expect((await service.getMine('coiffeur-1')).map((m) => m.body)).toEqual(['Message de Sofia']);
    expect((await service.getMine('coiffeur-2')).map((m) => m.body)).toEqual(['Message de Camille']);
  });

  it('sendAsAdmin() emits admin-message.sent for notifications/ to pick up', async () => {
    const handler = jest.fn();
    events.on('admin-message.sent', handler);

    const message = await service.sendAsAdmin('admin-1', 'coiffeur-1', 'Dernier avertissement.');

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: message.id,
        coiffeurId: 'coiffeur-1',
        body: 'Dernier avertissement.',
      }),
    );
  });
});
