import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Tests for chatStore module functions.
 * Since the module reads ATLAS_DATA_DIR at call time (not load time),
 * we can set it before each test and write a fresh store file.
 */

let tmpDir: string;
let savedDataDir: string | undefined;

async function resetStoreDir() {
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.writeFile(
    path.join(tmpDir, 'atlas-chat-store.json'),
    JSON.stringify({ conversations: [], messages: [] }),
  );
}

describe('chatStore', () => {
  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `atlas-chat-${Date.now()}-${Math.random()}`);
    savedDataDir = process.env.ATLAS_DATA_DIR;
    process.env.ATLAS_DATA_DIR = tmpDir;
  });

  afterEach(async () => {
    if (savedDataDir === undefined) {
      delete process.env.ATLAS_DATA_DIR;
    } else {
      process.env.ATLAS_DATA_DIR = savedDataDir;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('createConversation', () => {
    it('creates a new conversation with defaults', async () => {
      await resetStoreDir();
      const { createConversation } = await import('./chatStore');

      const convo = await createConversation();
      expect(convo.id).toMatch(/^conversation-/);
      expect(convo.title).toBe('Nova conversa');
      expect(convo.messageCount).toBe(0);
    });

    it('creates a conversation with custom model', async () => {
      await resetStoreDir();
      const { createConversation } = await import('./chatStore');

      const convo = await createConversation('gpt-4o');
      expect(convo.model).toBe('gpt-4o');
    });
  });

  describe('listConversations', () => {
    it('returns conversations sorted by updatedAt desc', async () => {
      await resetStoreDir();
      const { createConversation, listConversations } = await import('./chatStore');

      await createConversation('m1');
      await new Promise((r) => setTimeout(r, 10));
      await createConversation('m2');

      const list = await listConversations();
      expect(list.length).toBe(2);
      expect(list[0].updatedAt >= list[1].updatedAt).toBe(true);
    });
  });

  describe('appendUserMessage', () => {
    it('auto-creates conversation when ID not provided', async () => {
      await resetStoreDir();
      const { appendUserMessage } = await import('./chatStore');

      const result = await appendUserMessage(undefined, 'Hello world');
      expect(result.conversation.id).toMatch(/^conversation-/);
      expect(result.message.content).toBe('Hello world');
      expect(result.message.role).toBe('user');
    });

    it('generates title from content for new conversations', async () => {
      await resetStoreDir();
      const { appendUserMessage } = await import('./chatStore');

      const result = await appendUserMessage(undefined, 'How does the RAG pipeline work?');
      expect(result.conversation.title.length).toBeGreaterThan(0);
      expect(result.conversation.title).not.toBe('Nova conversa');
    });
  });

  describe('getMessages', () => {
    it('returns messages sorted by createdAt', async () => {
      await resetStoreDir();
      const { createConversation, appendUserMessage, appendAssistantMessage, getMessages } = await import('./chatStore');

      const convo = await createConversation();
      await appendUserMessage(convo.id, 'first');
      await appendAssistantMessage(convo.id, 'first response', 'model');

      const messages = await getMessages(convo.id);
      expect(messages.length).toBe(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });
  });

  describe('renameConversation', () => {
    it('renames a conversation', async () => {
      await resetStoreDir();
      const { createConversation, renameConversation } = await import('./chatStore');

      const convo = await createConversation();
      const renamed = await renameConversation(convo.id, 'New Title');
      expect(renamed.title).toBe('New Title');
    });
  });

  describe('appendAssistantMessage', () => {
    it('throws if conversation does not exist', async () => {
      await resetStoreDir();
      const { appendAssistantMessage } = await import('./chatStore');

      await expect(
        appendAssistantMessage('nonexistent-id', 'response', 'model'),
      ).rejects.toThrow();
    });
  });
});
