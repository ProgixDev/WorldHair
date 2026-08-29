import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { EnvironmentVariables } from '../config/env.validation';

export interface PushMessageInput {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushSendResult {
  token: string;
  ok: boolean;
  /** Expo's own error code (e.g. "DeviceNotRegistered") when ok is false. */
  error?: string;
}

/**
 * Thin wrapper around `expo-server-sdk` — same approach as the WhaleTime
 * project (D:\Others\WhaleTime). `EXPO_ACCESS_TOKEN` is optional; most Expo
 * projects don't need it (see env.validation.ts).
 */
@Injectable()
export class PushService {
  private readonly expo: Expo;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const accessToken = config.get('EXPO_ACCESS_TOKEN', { infer: true });
    this.expo = new Expo(accessToken ? { accessToken } : {});
  }

  /** Chunks to Expo's per-request limit internally; one bad chunk doesn't lose the others. */
  async send(messages: PushMessageInput[]): Promise<PushSendResult[]> {
    const results: PushSendResult[] = [];
    const valid: PushMessageInput[] = [];

    for (const message of messages) {
      if (Expo.isExpoPushToken(message.token)) {
        valid.push(message);
      } else {
        results.push({ token: message.token, ok: false, error: 'InvalidToken' });
      }
    }
    if (valid.length === 0) {
      return results;
    }

    const expoMessages: ExpoPushMessage[] = valid.map((message) => ({
      to: message.token,
      sound: 'default',
      title: message.title,
      body: message.body,
      data: message.data,
    }));

    const chunks = this.expo.chunkPushNotifications(expoMessages);
    let cursor = 0;
    for (const chunk of chunks) {
      const chunkMessages = valid.slice(cursor, cursor + chunk.length);
      cursor += chunk.length;
      try {
        const tickets: ExpoPushTicket[] = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, index) => {
          const token = chunkMessages[index].token;
          if (ticket.status === 'ok') {
            results.push({ token, ok: true });
          } else {
            results.push({ token, ok: false, error: ticket.details?.error ?? ticket.message });
          }
        });
      } catch {
        chunkMessages.forEach((message) => results.push({ token: message.token, ok: false, error: 'SendFailed' }));
      }
    }
    return results;
  }
}
