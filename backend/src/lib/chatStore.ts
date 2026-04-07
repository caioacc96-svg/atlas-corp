import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ChatConversationSummary, ChatMessage } from '../../../src/shared/types';
import { getAtlasConfig } from '../config/atlas-config';

interface ChatStoreData {
  conversations: ChatConversationSummary[];
  messages: ChatMessage[];
}

const defaultStore: ChatStoreData = {
  conversations: [],
  messages: [],
};

function dataDir() {
  return process.env.ATLAS_DATA_DIR || path.join(process.cwd(), '.atlas-data');
}

function storePath() {
  return path.join(dataDir(), 'atlas-chat-store.json');
}

function backupPath() {
  return path.join(dataDir(), 'atlas-chat-store.corrupted.json');
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

function defaultModel() {
  const cfg = getAtlasConfig();
  return cfg.openaiApiKey ? cfg.remoteModel : cfg.localModel;
}

async function readStore(): Promise<ChatStoreData> {
  await ensureDir();
  const def = defaultModel();
  try {
    const raw = await fs.readFile(storePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<ChatStoreData>;
    const conversations = Array.isArray(parsed.conversations) ? parsed.conversations : [];
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    return {
      conversations: conversations
        .filter((item) => item && typeof item.id === 'string')
        .map((item) => ({
          id: item.id,
          title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : 'Nova conversa',
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
          updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
          messageCount: typeof item.messageCount === 'number' ? item.messageCount : 0,
          model: typeof item.model === 'string' && item.model ? item.model : def,
          lastMessagePreview: typeof item.lastMessagePreview === 'string' ? item.lastMessagePreview : undefined,
        })),
      messages: messages
        .filter((item) => item && typeof item.id === 'string' && typeof item.conversationId === 'string')
        .map((item) => ({
          id: item.id,
          conversationId: item.conversationId,
          role: item.role === 'assistant' ? 'assistant' : 'user',
          content: typeof item.content === 'string' ? item.content : '',
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
          model: typeof item.model === 'string' ? item.model : undefined,
          status: item.status === 'streaming' || item.status === 'error' ? item.status : 'complete',
        })),
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      await writeStore(defaultStore);
      return defaultStore;
    }

    try {
      const raw = await fs.readFile(storePath(), 'utf8');
      await fs.writeFile(backupPath(), raw, 'utf8');
    } catch {
      // noop
    }

    await writeStore(defaultStore);
    return defaultStore;
  }
}

async function writeStore(data: ChatStoreData) {
  await ensureDir();
  await fs.writeFile(storePath(), JSON.stringify(data, null, 2), 'utf8');
}

function makeId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function summarize(content: string) {
  return content.replace(/\s+/g, ' ').trim().slice(0, 120);
}

function titleFromFirstMessage(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Nova conversa';
  return normalized.length > 56 ? `${normalized.slice(0, 56).trim()}…` : normalized;
}

function sortConversations(conversations: ChatConversationSummary[]) {
  return [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listConversations() {
  const store = await readStore();
  return sortConversations(store.conversations);
}

export async function createConversation(model?: string) {
  const m = model || defaultModel();
  const store = await readStore();
  const now = new Date().toISOString();
  const conversation: ChatConversationSummary = {
    id: makeId('conversation'),
    title: 'Nova conversa',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    model: m,
  };
  store.conversations.unshift(conversation);
  await writeStore(store);
  return conversation;
}

export async function getMessages(conversationId: string) {
  const store = await readStore();
  return store.messages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function renameConversation(conversationId: string, title: string) {
  const store = await readStore();
  const conversation = store.conversations.find((item) => item.id === conversationId);
  if (!conversation) throw new Error('Conversa não encontrada.');
  conversation.title = title.trim() || conversation.title;
  conversation.updatedAt = new Date().toISOString();
  await writeStore(store);
  return conversation;
}

export async function appendUserMessage(conversationId: string | undefined, content: string, model?: string) {
  const m = model || defaultModel();
  const store = await readStore();
  const now = new Date().toISOString();
  let conversation = store.conversations.find((item) => item.id === conversationId);

  if (!conversation) {
    conversation = {
      id: makeId('conversation'),
      title: titleFromFirstMessage(content),
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      model: m,
    };
    store.conversations.unshift(conversation);
  }

  if (conversation.title === 'Nova conversa') {
    conversation.title = titleFromFirstMessage(content);
  }

  const message: ChatMessage = {
    id: makeId('message'),
    conversationId: conversation.id,
    role: 'user',
    content,
    createdAt: now,
    status: 'complete',
  };

  store.messages.push(message);
  conversation.updatedAt = now;
  conversation.messageCount += 1;
  conversation.lastMessagePreview = summarize(content);
  await writeStore(store);

  return { conversation, message };
}

export async function appendAssistantMessage(conversationId: string, content: string, model: string, messageId?: string) {
  const store = await readStore();
  const conversation = store.conversations.find((item) => item.id === conversationId);
  if (!conversation) throw new Error('Conversa não encontrada ao registrar resposta do Atlas.');

  const now = new Date().toISOString();
  const message: ChatMessage = {
    id: messageId || makeId('message'),
    conversationId,
    role: 'assistant',
    content,
    createdAt: now,
    model,
    status: 'complete',
  };

  store.messages.push(message);
  conversation.updatedAt = now;
  conversation.messageCount += 1;
  conversation.lastMessagePreview = summarize(content);
  conversation.model = model;
  await writeStore(store);
  return { conversation, message };
}

export async function listMessagesForPrompt(conversationId: string) {
  const messages = await getMessages(conversationId);
  return messages.slice(-24);
}
