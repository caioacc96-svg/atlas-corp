import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getAtlasConfig } from '../../config/atlas-config';
import type { ChatRole } from './types';

export interface Thread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ThreadMessage[];
}

export interface ThreadMessage {
  role: ChatRole;
  content: string;
  createdAt: string;
  model?: string;
  status?: 'complete' | 'streaming' | 'error';
}

function threadsDir(): string {
  return path.join(getAtlasConfig().dataDir, 'threads');
}

function threadFile(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(threadsDir(), `${safe}.json`);
}

async function ensureThreadsDir(): Promise<void> {
  await fs.mkdir(threadsDir(), { recursive: true });
}

export async function createThread(title = 'New thread'): Promise<Thread> {
  await ensureThreadsDir();
  const thread: Thread = {
    id: randomUUID(),
    title: title.slice(0, 60),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
  await saveThread(thread);
  return thread;
}

export async function getThread(id: string): Promise<Thread | null> {
  try {
    const raw = await fs.readFile(threadFile(id), 'utf-8');
    return JSON.parse(raw) as Thread;
  } catch (err: any) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function saveThread(thread: Thread): Promise<void> {
  await ensureThreadsDir();
  thread.updatedAt = new Date().toISOString();
  const tmp = `${threadFile(thread.id)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(thread, null, 2), 'utf-8');
  await fs.rename(tmp, threadFile(thread.id));
}

export async function appendMessage(
  threadId: string,
  message: ThreadMessage,
): Promise<Thread> {
  const thread = await getThread(threadId);
  if (!thread) throw new Error(`Thread not found: ${threadId}`);
  thread.messages.push({ ...message, createdAt: message.createdAt || new Date().toISOString() });
  await saveThread(thread);
  return thread;
}

export async function listThreads(): Promise<Omit<Thread, 'messages'>[]> {
  await ensureThreadsDir();
  let files: string[];
  try {
    files = await fs.readdir(threadsDir());
  } catch {
    return [];
  }

  const results: Omit<Thread, 'messages'>[] = [];
  for (const file of files.filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'))) {
    try {
      const raw = await fs.readFile(path.join(threadsDir(), file), 'utf-8');
      const t = JSON.parse(raw) as Thread;
      results.push({
        id: t.id, title: t.title, createdAt: t.createdAt, updatedAt: t.updatedAt,
      });
    } catch {
      // skip corrupt files
    }
  }

  return results.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function deleteThread(id: string): Promise<boolean> {
  try {
    await fs.unlink(threadFile(id));
    return true;
  } catch (err: any) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

// --- Migration helper ---

/** Check if migration is needed (old single-file store exists). */
function oldChatStorePath(): string {
  return path.join(getAtlasConfig().dataDir, 'atlas-chat-store.json');
}

/**
 * Migrate messages from old single-file store into thread-based system.
 * Does NOT delete old data — leaves it as backup.
 */
export async function migrateFromLegacyStore(): Promise<{ migratedCount: number }> {
  const storePath = oldChatStorePath();
  let migrated = 0;

  try {
    const raw = await fs.readFile(storePath, 'utf-8');
    const store = JSON.parse(raw) as {
      conversations?: Array<{ id: string; title: string; createdAt: string; updatedAt: string; model: string }>;
      messages?: Array<{ id: string; conversationId: string; role: string; content: string; createdAt: string; model?: string; status?: string }>;
    };

    const conversations = store.conversations ?? [];
    const messages = store.messages ?? [];

    if (conversations.length === 0) return { migratedCount: 0 };

    // Check if threads already exist (don't double-migrate)
    await ensureThreadsDir();
    const existingFiles = (await fs.readdir(threadsDir())).filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'));
    if (existingFiles.length > 0) {
      return { migratedCount: 0 }; // Already migrated or user has threads
    }

    for (const conv of conversations) {
      const thread: Thread = {
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messages: messages
          .filter((m) => m.conversationId === conv.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user' as ChatRole,
            content: m.content,
            createdAt: m.createdAt,
            model: m.model,
            status: m.status as ThreadMessage['status'] || 'complete',
          })),
      };
      await saveThread(thread);
      migrated++;
    }

    // Rename old file to make backup
    const backup = `${storePath}.migrated-backup`;
    await fs.rename(storePath, backup);
  } catch (err: any) {
    if (err.code === 'ENOENT') return { migratedCount: 0 };
    // On any error, skip migration gracefully
  }

  return { migratedCount: migrated };
}
