export const AI_TTS_STREAM_EVENT = 'ai.tts.stream';

export type AiTtsStreamEvent =
  | { type: 'start'; sessionId: string; query: string }
  | { type: 'chunk'; sessionId: string; chunk: string }
  | { type: 'end'; sessionId: string }
  | { type: 'error'; sessionId: string; error: string };

export const AVATAR_ACTION_EVENT = 'avatar.action';

export interface AvatarActionPayload {
  action: 'expression' | 'motion';
  emotion?: string;
  group?: string;
  index?: number;
}
