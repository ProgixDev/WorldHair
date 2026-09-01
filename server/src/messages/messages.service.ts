import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../database/supabase.service';

export type SenderRole = 'admin' | 'coiffeur';

export interface CoiffeurMessage {
  id: string;
  coiffeurId: string;
  senderRole: SenderRole;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface ThreadSummary {
  coiffeurId: string;
  firstName: string;
  lastName: string;
  email: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadForAdmin: number;
}

interface CoiffeurMessageRow {
  id: string;
  coiffeur_id: string;
  sender_role: SenderRole;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

interface ProfileRow {
  id: string;
  first_name: string;
  last_name: string;
}

function mapRow(row: CoiffeurMessageRow): CoiffeurMessage {
  return {
    id: row.id,
    coiffeurId: row.coiffeur_id,
    senderRole: row.sender_role,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

/**
 * "Messagerie interne admin ↔ coiffeur (litige avant bannissement)"
 * (TODO.md → Back-office admin). One implicit thread per coiffeur
 * (`coiffeur_messages.coiffeur_id`), no separate threads table — see
 * `../../schema.sql`. The coiffeur side (`getMine`/`sendAsCoiffeur`) has no
 * mobile screen yet; only the admin side (`/admin/messagerie`) is wired up
 * so far.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly events: EventEmitter2,
  ) {}

  async listThreadsForAdmin(): Promise<ThreadSummary[]> {
    const { data: profiles, error: profilesError } = await this.supabase.client
      .from('profiles')
      .select()
      .eq('role', 'coiffeur');
    if (profilesError) {
      throw new InternalServerErrorException(profilesError.message);
    }

    const { data: messages, error: messagesError } = await this.supabase.client
      .from('coiffeur_messages')
      .select()
      .order('created_at');
    if (messagesError) {
      throw new InternalServerErrorException(messagesError.message);
    }
    const rows = messages as CoiffeurMessageRow[];
    const profileRows = profiles as ProfileRow[];
    const emailById = await this.emailsById(profileRows.map((profile) => profile.id));

    return profileRows
      .map((profile) => {
        const thread = rows.filter((row) => row.coiffeur_id === profile.id);
        const last = thread[thread.length - 1] as CoiffeurMessageRow | undefined;
        return {
          coiffeurId: profile.id,
          firstName: profile.first_name,
          lastName: profile.last_name,
          email: emailById.get(profile.id) ?? '',
          lastMessage: last?.body ?? null,
          lastMessageAt: last?.created_at ?? null,
          unreadForAdmin: thread.filter((row) => row.sender_role === 'coiffeur' && !row.read_at).length,
        };
      })
      .sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt.localeCompare(a.lastMessageAt);
        if (a.lastMessageAt) return -1;
        if (b.lastMessageAt) return 1;
        return 0;
      });
  }

  async getThreadForAdmin(coiffeurId: string): Promise<CoiffeurMessage[]> {
    await this.markRead(coiffeurId, 'coiffeur');
    return this.getThread(coiffeurId);
  }

  async sendAsAdmin(adminId: string, coiffeurId: string, body: string): Promise<CoiffeurMessage> {
    const message = await this.insert(coiffeurId, 'admin', adminId, body);
    this.events.emit('admin-message.sent', {
      messageId: message.id,
      coiffeurId,
      body: message.body,
    });
    return message;
  }

  async getMine(coiffeurId: string): Promise<CoiffeurMessage[]> {
    await this.markRead(coiffeurId, 'admin');
    return this.getThread(coiffeurId);
  }

  async sendAsCoiffeur(coiffeurId: string, body: string): Promise<CoiffeurMessage> {
    return this.insert(coiffeurId, 'coiffeur', coiffeurId, body);
  }

  private async getThread(coiffeurId: string): Promise<CoiffeurMessage[]> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_messages')
      .select()
      .eq('coiffeur_id', coiffeurId)
      .order('created_at');
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data as CoiffeurMessageRow[]).map(mapRow);
  }

  private async insert(
    coiffeurId: string,
    senderRole: SenderRole,
    senderId: string,
    body: string,
  ): Promise<CoiffeurMessage> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_messages')
      .insert({ coiffeur_id: coiffeurId, sender_role: senderRole, sender_id: senderId, body })
      .select()
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return mapRow(data as CoiffeurMessageRow);
  }

  /** Same paginated lookup as AdminAccountsService.emailsById — no bulk-by-id lookup in supabase-js. */
  private async emailsById(ids: string[]): Promise<Map<string, string>> {
    const wanted = new Set(ids);
    const result = new Map<string, string>();
    let page = 1;
    for (;;) {
      const { data, error } = await this.supabase.client.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const user of data.users) {
        if (wanted.has(user.id)) {
          result.set(user.id, user.email ?? '');
        }
      }
      if (data.users.length < 200 || result.size === wanted.size) {
        return result;
      }
      page += 1;
    }
  }

  /** Marks every unread message from `unreadSenderRole` in this thread as read by the other party. */
  private async markRead(coiffeurId: string, unreadSenderRole: SenderRole): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_messages')
      .select()
      .eq('coiffeur_id', coiffeurId)
      .eq('sender_role', unreadSenderRole)
      .is('read_at', null);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const readAt = new Date().toISOString();
    await Promise.all(
      (data as CoiffeurMessageRow[]).map((row) =>
        this.supabase.client.from('coiffeur_messages').update({ read_at: readAt }).eq('id', row.id),
      ),
    );
  }
}
