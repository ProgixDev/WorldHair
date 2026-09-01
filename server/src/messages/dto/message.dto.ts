import { CoiffeurMessage, SenderRole, ThreadSummary } from '../messages.service';

/** What both the coiffeur's own thread and the admin thread view see. */
export class CoiffeurMessageDto {
  id!: string;
  coiffeurId!: string;
  senderRole!: SenderRole;
  senderId!: string;
  body!: string;
  createdAt!: string;
  readAt!: string | null;
}

export function toCoiffeurMessageDto(message: CoiffeurMessage): CoiffeurMessageDto {
  return { ...message };
}

/** One row per coiffeur in the admin's `/admin/messagerie` thread list. */
export class ThreadSummaryDto {
  coiffeurId!: string;
  firstName!: string;
  lastName!: string;
  email!: string;
  lastMessage!: string | null;
  lastMessageAt!: string | null;
  unreadForAdmin!: number;
}

export function toThreadSummaryDto(thread: ThreadSummary): ThreadSummaryDto {
  return { ...thread };
}
