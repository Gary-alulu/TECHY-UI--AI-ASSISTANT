import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Conversation, FileAttachment, Message, ToolExecution } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");

type StoredMessage = {
  id: string;
  role: Message["role"];
  content: string;
  timestamp: string;
  attachments?: FileAttachment[];
  toolExecution?: ToolExecution;
  toolExecutions?: ToolExecution[];
};

type StoredConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
};

function toDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function toMessage(entry: StoredMessage): Message {
  return {
    id: entry.id,
    role: entry.role,
    content: entry.content,
    timestamp: toDate(entry.timestamp),
    ...(entry.attachments && entry.attachments.length > 0 ? { attachments: entry.attachments } : {}),
    ...(entry.toolExecutions && entry.toolExecutions.length > 0 ? { toolExecutions: entry.toolExecutions } : {}),
    ...(entry.toolExecution ? { toolExecution: entry.toolExecution } : {}),
  };
}

function toConversation(entry: StoredConversation): Conversation {
  return {
    id: entry.id,
    title: entry.title,
    createdAt: toDate(entry.createdAt),
    updatedAt: toDate(entry.updatedAt),
    messages: entry.messages.map(toMessage),
  };
}

async function readAll(): Promise<StoredConversation[]> {
  try {
    const raw = await fs.readFile(CONVERSATIONS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Serializes writes so concurrent requests cannot race a previous save. */
let writeQueue: Promise<unknown> = Promise.resolve();

function queueWrite(updater: (all: StoredConversation[]) => StoredConversation[]): Promise<StoredConversation[]> {
  const run = writeQueue.then(async () => {
    const next = updater(await readAll());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CONVERSATIONS_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: Date;
  messageCount: number;
}

export async function listConversations(): Promise<{ summaries: ConversationSummary[]; current: Conversation | null }> {
  const all = await readAll();
  all.sort((a, b) => toDate(b.updatedAt).getTime() - toDate(a.updatedAt).getTime());
  return {
    summaries: all.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: toDate(conversation.updatedAt),
      messageCount: conversation.messages.length,
    })),
    current: all.length > 0 ? toConversation(all[0]) : null,
  };
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const all = await readAll();
  const found = all.find((conversation) => conversation.id === id);
  return found ? toConversation(found) : null;
}

export async function createConversation(): Promise<Conversation> {
  const now = new Date().toISOString();
  const conversation: StoredConversation = {
    id: randomUUID(),
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  await queueWrite((all) => [...all, conversation]);
  return toConversation(conversation);
}

export async function appendMessage(
  conversationId: string,
  input: {
    role: "user" | "assistant";
    content: string;
    attachments?: FileAttachment[];
    toolExecution?: ToolExecution;
    toolExecutions?: ToolExecution[];
    replaceLast?: boolean;
  }
): Promise<{ message: Message; conversation: Conversation } | null> {
  const now = new Date().toISOString();
  let stored: StoredMessage | null = null;

  await queueWrite((all) => {
    const conversation = all.find((entry) => entry.id === conversationId);
    if (!conversation) return all;

    if (input.replaceLast && conversation.messages.length > 0) {
      const last = conversation.messages[conversation.messages.length - 1];
      if (last.role === "assistant") {
        conversation.messages[conversation.messages.length - 1] = {
          ...last,
          content: input.content,
          ...(input.toolExecutions && input.toolExecutions.length > 0 ? { toolExecutions: input.toolExecutions } : {}),
          ...(input.toolExecution ? { toolExecution: input.toolExecution } : {}),
          ...(input.attachments ? { attachments: input.attachments } : {}),
        };
        conversation.updatedAt = now;
        stored = conversation.messages[conversation.messages.length - 1];
        return all;
      }
    }

    stored = {
      id: randomUUID(),
      role: input.role,
      content: input.content,
      timestamp: now,
    };
    if (input.attachments && input.attachments.length > 0) stored.attachments = input.attachments;
    if (input.toolExecution) stored.toolExecution = input.toolExecution;
    if (input.toolExecutions && input.toolExecutions.length > 0) stored.toolExecutions = input.toolExecutions;
    conversation.messages.push(stored);
    conversation.updatedAt = now;
    if (input.role === "user" && conversation.title === "New chat") {
      conversation.title = input.content.trim().slice(0, 48) || conversation.title;
    }
    return all;
  });

  if (!stored) return null;
  const conversation = await getConversation(conversationId);
  return conversation ? { message: toMessage(stored), conversation } : null;
}

export async function renameConversation(id: string, title: string): Promise<boolean> {
  const clean = title.trim().slice(0, 80);
  if (!clean) return false;
  let renamed = false;
  await queueWrite((all) => {
    const conversation = all.find((entry) => entry.id === id);
    if (!conversation) return all;
    conversation.title = clean;
    conversation.updatedAt = new Date().toISOString();
    renamed = true;
    return all;
  });
  return renamed;
}

export async function deleteConversation(id: string): Promise<boolean> {
  let existed = false;
  await queueWrite((all) => {
    const filtered = all.filter((conversation) => conversation.id !== id);
    existed = all.length !== filtered.length;
    return filtered;
  });
  return existed;
}