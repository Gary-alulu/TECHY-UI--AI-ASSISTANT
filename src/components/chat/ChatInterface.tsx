"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";
import { AIInput } from "../ai/AIInput";
import { GlassPanel } from "../ui/GlassPanel";
import { HUDButton } from "../ui/HUDButton";
import {
  AlertTriangle,
  ChevronLeft,
  FileCode2,
  FileDown,
  History,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileAttachment, Message, ToolExecution } from "@/types";

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface WireMessage {
  id: string;
  role: Message["role"];
  content: string;
  timestamp: string;
  attachments?: FileAttachment[];
  toolExecution?: ToolExecution;
  toolExecutions?: ToolExecution[];
}

interface WireConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: WireMessage[];
}

interface AttachPayload {
  name: string;
  type: string;
  size: number;
  text?: string;
}

type StreamEvent =
  | { type: "meta"; available: boolean; model?: string }
  | { type: "status"; state: string; tool?: string; detail?: string }
  | { type: "tool"; execution: ToolExecution }
  | { type: "delta"; content: string }
  | { type: "done"; executions?: ToolExecution[] }
  | { type: "error"; message: string };

const SUGGESTIONS = [
  "Check my system resources",
  "List my top 5 processes",
  "Show my installed apps",
  "How much storage is left?",
];

const OFFLINE_REPLY =
  "I'm not connected to a local AI model right now — Ollama on localhost:11434 wasn't found. " +
  "Install and start Ollama, then pull a model and I'll be able to answer with real tool access.";

const TEXT_EXTENSIONS = /\.(ts|tsx|js|jsx|json|md|markdown|css|scss|html|xml|yaml|yml|toml|ini|cfg|py|txt|log|env|sh|ps1|bat|csv|svg)$/i;
const MAX_CONTEXT_CHARS = 48_000;
const MAX_FILE_CHARS = 4000;

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function withDates(messages: WireMessage[]): Message[] {
  return messages.map((message) => ({ ...message, timestamp: new Date(message.timestamp) }));
}

function isTextAttachment(file: File): boolean {
  return file.size <= 1024 * 1024 && (file.type.startsWith("text/") || TEXT_EXTENSIONS.test(file.name));
}

export function ChatInterface() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("New chat");
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [replyNote, setReplyNote] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  const activeIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const sendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const attachFilesRef = useRef<Map<string, File>>(new Map());
  const pendingQRef = useRef<string | null>(null);
  const sentPrefillRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const canStop = sending;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, sending, runStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    pendingQRef.current = params.get("q");
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const list = await fetch("/api/conversations", { cache: "no-store" });
      if (!list.ok) return;
      const data = (await list.json()) as { conversations: ConversationSummary[] };
      setConversations(data.conversations);
      const current = activeIdRef.current;
      if (current) {
        const active = data.conversations.find((entry) => entry.id === current);
        if (active) setTitle(active.title);
      }
    } catch {
      // keep local list
    }
  }, []);

  const persistMessage = useCallback(
    async (conversationId: string, payload: { role: "user" | "assistant"; content: string; attachments?: FileAttachment[]; toolExecutions?: ToolExecution[]; replaceLast?: boolean }) => {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Failed to save (${response.status})`);
      const data = (await response.json()) as { message: Message };
      return data.message;
    },
    []
  );

  const buildInlineContext = useCallback(async (payloads: FileAttachment[]): Promise<AttachPayload[]> => {
    const chosen: AttachPayload[] = [];
    let total = 0;
    for (const attachment of payloads) {
      const file = attachFilesRef.current.get(attachment.id);
      let text: string | undefined;
      if (file && isTextAttachment(file)) {
        try {
          text = await file.text();
        } catch {
          text = undefined;
        }
      }
      const snippet = text?.slice(0, MAX_FILE_CHARS);
      if (snippet) {
        if (total + snippet.length > MAX_CONTEXT_CHARS) {
          chosen.push({ name: attachment.name, type: attachment.type, size: attachment.size });
          continue;
        }
        total += snippet.length;
        chosen.push({ name: attachment.name, type: attachment.type, size: attachment.size, text: snippet });
      } else {
        chosen.push({ name: attachment.name, type: attachment.type, size: attachment.size });
      }
    }
    return chosen;
  }, []);

  const performStream = useCallback(
    async (options: {
      conversationId: string;
      history: Message[];
      userText: string;
      userAttachments?: FileAttachment[];
      persistUser?: boolean;
      replaceLast?: boolean;
    }): Promise<void> => {
      const { conversationId, history, userText, userAttachments, persistUser, replaceLast } = options;
      const assistantId = randomId();
      const bufferedText = { value: "" };
      const bufferedExecutions: ToolExecution[] = [];
      const controller = new AbortController();
      abortRef.current = controller;
      stoppedRef.current = false;
      setRunStatus(null);

      const placeholder: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };
      setMessages((previous) => [...previous, placeholder]);

      let flushRaf = 0;
      const flush = () => {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? { ...message, content: bufferedText.value, toolExecutions: [...bufferedExecutions] }
              : message
          )
        );
      };
      const scheduleFlush = () => {
        if (flushRaf) cancelAnimationFrame(flushRaf);
        flushRaf = requestAnimationFrame(() => {
          flushRaf = 0;
          flush();
        });
      };

      try {
        const wireHistory = history
          .filter((entry) => !entry.isStreaming)
          .map((entry) => ({ role: entry.role, content: entry.content }));

        let contextPayload: AttachPayload[] = [];
        if (userAttachments && userAttachments.length > 0) {
          contextPayload = await buildInlineContext(userAttachments);
        }
        if (persistUser) {
          const persisted = await persistMessage(
            conversationId,
            userAttachments && userAttachments.length > 0
              ? { role: "user", content: userText, attachments: userAttachments }
              : { role: "user", content: userText }
          );
          setMessages((previous) => previous.map((message) => (message.content === "" && false ? message : message)));
          void persisted;
        }

        const replyRequest = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...wireHistory, { role: "user", content: userText }], attachments: contextPayload }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!replyRequest.ok) throw new Error(`Chat stream returned ${replyRequest.status}`);
        if (!replyRequest.body) throw new Error("Chat stream had no body");

        const reader = replyRequest.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let available = false;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("{")) continue;
            let event: StreamEvent;
            try {
              event = JSON.parse(trimmed) as StreamEvent;
            } catch {
              continue;
            }
            switch (event.type) {
              case "meta":
                available = event.available === true;
                break;
              case "status":
                setRunStatus(event.tool ? `Executing ${event.tool}` : event.state);
                break;
              case "tool":
                if (!bufferedExecutions.some((execution) => execution.id === event.execution.id)) {
                  bufferedExecutions.push(event.execution);
                }
                setRunStatus(event.execution.status === "completed" || event.execution.status === "failed" ? null : `Executing ${event.execution.toolName}`);
                scheduleFlush();
                break;
              case "delta":
                bufferedText.value += event.content;
                scheduleFlush();
                break;
              case "error":
                setError(event.message);
                break;
              case "done":
                if (event.executions) {
                  bufferedExecutions.length = 0;
                  bufferedExecutions.push(...event.executions);
                  scheduleFlush();
                }
                break;
            }
          }
        }
        if (flushRaf) {
          cancelAnimationFrame(flushRaf);
          flushRaf = 0;
        }
        flush();

        if (!available || !bufferedText.value) {
          bufferedText.value = OFFLINE_REPLY;
          setReplyNote("Local AI model isn't connected (needs Ollama on localhost:11434). Install Ollama to enable streaming replies with tool access.");
          flush();
        }

        await persistMessage(conversationId, {
          role: "assistant",
          content: bufferedText.value,
          toolExecutions: bufferedExecutions,
          replaceLast,
        });
      } catch (err) {
        if (abortRef.current?.signal.aborted || stoppedRef.current) {
          if (flushRaf) {
            cancelAnimationFrame(flushRaf);
            flushRaf = 0;
          }
          flush();
          if (bufferedText.value.trim()) {
            setMessages((previous) =>
              previous.map((message) => (message.id === assistantId ? { ...message, isStreaming: false } : message))
            );
            try {
              await persistMessage(conversationId, {
                role: "assistant",
                content: bufferedText.value,
                toolExecutions: bufferedExecutions,
                replaceLast,
              });
            } catch {
              // best effort
            }
          } else {
            setMessages((previous) =>
              previous.map((message) =>
                message.id === assistantId ? { ...message, content: "(Generation stopped)", isStreaming: false } : message
              )
            );
          }
        } else {
          setMessages((previous) =>
            previous.map((message) => (message.id === assistantId ? { ...message, isStreaming: false } : message))
          );
          setError(err instanceof Error ? err.message : "Something went wrong while streaming");
        }
      } finally {
        abortRef.current = null;
        setSending(false);
        setRunStatus(null);
        sendingRef.current = false;
        void refreshList();
      }
    },
    [buildInlineContext, persistMessage, refreshList]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sendingRef.current) return;
      sendingRef.current = true;

      let conversationId = activeIdRef.current;
      let createdId: string | null = null;

      try {
        if (!conversationId) {
          const created = await fetch("/api/conversations", { method: "POST", cache: "no-store" });
          if (!created.ok) throw new Error(`Failed to start a conversation (${created.status})`);
          const createdData = (await created.json()) as { conversation: WireConversation };
          const newId = createdData.conversation.id;
          conversationId = newId;
          createdId = newId;
          activeIdRef.current = newId;
          setActiveId(newId);
          setConversations((previous) => [
            { id: newId, title: "New chat", updatedAt: new Date().toISOString(), messageCount: 0 },
            ...previous,
          ]);
        }

        setSending(true);
        setError(null);
        setReplyNote(null);

        const current = messagesRef.current;
        const userMessage: Message = {
          id: randomId(),
          role: "user",
          content,
          timestamp: new Date(),
          ...(attachments.length > 0 ? { attachments } : {}),
        };
        setMessages((previous) => [...previous, userMessage]);
        const settled = conversationId;
        const pendingAttachments = attachments;
        setAttachments([]);
        attachFilesRef.current = new Map();

        const history = current;
        await performStream({
          conversationId: settled,
          history,
          userText: content,
          userAttachments: pendingAttachments,
          persistUser: true,
          replaceLast: false,
        });
        void createdId;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong sending your message");
        sendingRef.current = false;
        setSending(false);
      }
    },
    [attachments, performStream]
  );

  const regenerate = useCallback(async () => {
    if (sendingRef.current || !activeIdRef.current) return;
    const current = messagesRef.current;
    let lastUserIdx = -1;
    for (let i = current.length - 1; i >= 0; i--) {
      if (current[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return;
    const userMessage = current[lastUserIdx];
    const history = current.slice(0, lastUserIdx);

    setMessages(current.slice(0, lastUserIdx + 1));
    setError(null);
    setReplyNote(null);
    sendingRef.current = true;
    setSending(true);

    try {
      await performStream({
        conversationId: activeIdRef.current,
        history,
        userText: userMessage.content,
        userAttachments: userMessage.attachments,
        persistUser: false,
        replaceLast: true,
      });
    } catch {
      sendingRef.current = false;
      setSending(false);
    }
  }, [performStream]);

  const stopGeneration = useCallback(() => {
    stoppedRef.current = true;
    abortRef.current?.abort();
  }, []);

  const handleFileAction = useCallback(
    (path: string, action: "summarize" | "analyze") => {
      void sendMessage(action === "summarize" ? `Summarize the file: ${path}` : `Analyze the file: ${path}`);
    },
    [sendMessage]
  );

  const loadConversations = useCallback(async () => {
    setInitialLoading(true);
    try {
      const response = await fetch("/api/conversations", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { conversations: ConversationSummary[]; current: WireConversation | null };
      setConversations(data.conversations ?? []);
      if (data.current) {
        activeIdRef.current = data.current.id;
        setActiveId(data.current.id);
        setTitle(data.current.title);
        setMessages(withDates(data.current.messages));
      }
      setError(null);

      const pendingQ = pendingQRef.current;
      if (pendingQ && !sentPrefillRef.current) {
        sentPrefillRef.current = true;
        void sendMessage(pendingQ);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setInitialLoading(false);
    }
  }, [sendMessage]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadConversations();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadConversations]);

  const selectConversation = useCallback(
    async (id: string) => {
      if (sendingRef.current) return;
      try {
        const response = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const data = (await response.json()) as { conversation: WireConversation };
        if (!data.conversation) throw new Error("Conversation not found");
        const conversation = data.conversation;
        activeIdRef.current = conversation.id;
        setActiveId(conversation.id);
        setTitle(conversation.title);
        setMessages(withDates(conversation.messages));
        setHistoryOpen(false);
        setReplyNote(null);
        setError(null);
        setRunStatus(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not open that conversation");
      }
    },
    []
  );

  const startNewChat = useCallback(async () => {
    try {
      const response = await fetch("/api/conversations", { method: "POST", cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { conversation: WireConversation };
      const conversation = data.conversation;
      activeIdRef.current = conversation.id;
      setActiveId(conversation.id);
      setMessages([]);
      setTitle("New chat");
      setReplyNote(null);
      setError(null);
      setRunStatus(null);
      setConversations((previous) => [
        { id: conversation.id, title: "New chat", updatedAt: conversation.updatedAt, messageCount: 0 },
        ...previous,
      ]);
      setHistoryOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start a new chat");
    }
  }, []);

  const renameConversation = useCallback(async () => {
    const nextTitle = titleDraft.trim();
    if (!activeIdRef.current || !nextTitle || nextTitle === title) {
      setRenaming(false);
      return;
    }
    try {
      const response = await fetch(`/api/conversations/${activeIdRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setTitle(nextTitle);
      setConversations((previous) =>
        previous.map((entry) => (entry.id === activeIdRef.current ? { ...entry, title: nextTitle } : entry))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename conversation");
    } finally {
      setRenaming(false);
    }
  }, [title, titleDraft]);

  const deleteConversation = useCallback(
    async (id: string) => {
      if (sendingRef.current) return;
      try {
        const response = await fetch(`/api/conversations/${id}`, { method: "DELETE", cache: "no-store" });
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        setConversations((previous) => previous.filter((entry) => entry.id !== id));
        if (activeIdRef.current === id) {
          activeIdRef.current = null;
          setActiveId(null);
          setMessages([]);
          setTitle("New chat");
          setReplyNote(null);
          setRunStatus(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete conversation");
      }
    },
    []
  );

  const download = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const exportMarkdown = useCallback(() => {
    const lines = [`# ${title}`, "", ...messages.map((message) => `**${message.role === "user" ? "You" : "TECHY"}**\n\n${message.content}\n`)];
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, "_") || "conversation";
    download(`${safeTitle}.md`, lines.join("\n"), "text/markdown;charset=utf-8");
  }, [title, messages]);

  const exportJson = useCallback(() => {
    const payload = messages.map((message) => ({
      role: message.role,
      content: message.content,
      timestamp: message.timestamp.toISOString(),
      attachments: message.attachments ?? undefined,
      toolExecutions: message.toolExecutions ?? undefined,
    }));
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, "_") || "conversation";
    download(`${safeTitle}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  }, [title, messages]);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((entry) => entry.title.toLowerCase().includes(query));
  }, [conversations, searchQuery]);

  const handleAttach = useCallback((files: File[]) => {
    setAttachments((previous) => {
      const next = [...previous];
      for (const file of files) {
        const id = randomId();
        attachFilesRef.current.set(id, file);
        next.push({ id, name: file.name, type: file.type || "application/octet-stream", size: file.size });
      }
      return next.slice(0, 8);
    });
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    attachFilesRef.current.delete(id);
    setAttachments((previous) => previous.filter((entry) => entry.id !== id));
  }, []);

  return (
    <div className="flex h-full gap-4">
      {historyOpen && (
        <aside className="w-72 shrink-0 flex flex-col min-h-0 glass-panel p-3">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="text-display text-sm font-semibold tracking-wider text-cyan-400 uppercase">
              Conversations
            </div>
            <HUDButton
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-slate-400"
              onClick={() => setHistoryOpen(false)}
              aria-label="Close history"
            >
              <ChevronLeft size={14} />
            </HUDButton>
          </div>
          <div className="relative mb-2 shrink-0">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-navy-950/60 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/40"
            />
          </div>
          <div className="flex-1 overflow-y-auto -mr-2 pr-2 space-y-1.5">
            {filteredConversations.length === 0 && (
              <p className="text-xs text-slate-500 py-6 text-center">
                {conversations.length === 0 ? "No conversations yet." : "No matches."}
              </p>
            )}
            {filteredConversations.map((conversation) => {
              const isActive = conversation.id === activeId;
              return (
                <div
                  key={conversation.id}
                  onClick={() => selectConversation(conversation.id)}
                  className={cn(
                    "group flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all",
                    isActive
                      ? "bg-cyan-950/20 border-cyan-400/30"
                      : "bg-navy-950/50 border-slate-800 hover:border-cyan-400/30 hover:bg-cyan-950/10"
                  )}
                >
                  <MessageSquare size={13} className="shrink-0 text-slate-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-300 truncate">{conversation.title}</p>
                    <p className="text-[10px] font-mono text-slate-500">
                      {new Date(conversation.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      {conversation.messageCount}
                    </p>
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all shrink-0"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteConversation(conversation.id);
                    }}
                    aria-label={`Delete ${conversation.title}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>
      )}

      <GlassPanel className="flex-1 flex flex-col h-full p-0 overflow-hidden border-cyan-400/20">
        {/* Header */}
        <div className="h-14 border-b border-cyan-400/10 flex items-center justify-between px-6 bg-navy-950/50 shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("w-2 h-2 rounded-full", canStop ? "bg-amber-400 animate-pulse glow-cyan" : "bg-emerald-500 glow-cyan")} />
            {renaming ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={() => void renameConversation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void renameConversation();
                  if (event.key === "Escape") {
                    setRenaming(false);
                    setTitleDraft(title);
                  }
                }}
                className="bg-navy-950/80 border border-cyan-400/40 rounded px-2 py-0.5 text-sm text-slate-200 focus:outline-none"
              />
            ) : (
              <h2 className="font-display font-medium tracking-wide text-slate-200 truncate max-w-[30vw]">{title}</h2>
            )}
            {!renaming && (
              <button
                onClick={() => {
                  setTitleDraft(title);
                  setRenaming(true);
                }}
                className="text-slate-500 hover:text-cyan-400 transition-colors shrink-0"
                aria-label="Rename conversation"
                title="Rename"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {runStatus && (
              <span className="text-[11px] font-mono text-cyan-400 animate-pulse hidden sm:inline">⌁ {runStatus}</span>
            )}
            {canStop && (
              <HUDButton variant="outline" size="sm" className="border-red-500/40 text-red-300 hover:bg-red-950/30" onClick={stopGeneration}>
                <Square size={12} className="mr-2 fill-current" />
                Stop
              </HUDButton>
            )}
            <HUDButton variant="ghost" size="sm" className="text-slate-400" onClick={() => setHistoryOpen((open) => !open)}>
              <History size={14} className="mr-2" />
              History
            </HUDButton>
            {messages.length > 0 && (
              <>
                <HUDButton variant="ghost" size="sm" className="text-slate-400" onClick={exportMarkdown} title="Export as Markdown">
                  <FileDown size={14} className="mr-2" />
                  MD
                </HUDButton>
                <HUDButton variant="ghost" size="sm" className="text-slate-400" onClick={exportJson} title="Export as JSON">
                  <FileCode2 size={14} className="mr-2" />
                  JSON
                </HUDButton>
              </>
            )}
            <HUDButton variant="outline" size="sm" className="border-cyan-400/30 text-cyan-400" onClick={startNewChat}>
              <Plus size={14} className="mr-2" />
              New Chat
            </HUDButton>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth min-h-0">
          <div className="max-w-3xl mx-auto space-y-8">
            {initialLoading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mt-24">
                <Loader2 size={16} className="animate-spin text-cyan-400" />
                Loading conversations...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[55vh] gap-5 text-center">
                <div className="w-16 h-16 rounded-xl bg-cyan-950 border border-cyan-400/30 text-cyan-400 flex items-center justify-center glow-cyan">
                  <span className="font-display font-bold text-2xl">T</span>
                </div>
                <div>
                  <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">What can I do for you today?</h2>
                  <p className="text-sm text-slate-400 mt-2 max-w-md">
                    TECHY runs fully local. Ask about your system resources, files, or installed apps — nothing leaves your machine.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => void sendMessage(suggestion)}
                      className="px-3 py-1.5 text-xs font-mono text-cyan-400 bg-cyan-950/20 border border-cyan-400/20 rounded-full hover:border-cyan-400/50 hover:bg-cyan-950/40 transition-colors cursor-pointer"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} onRegenerate={sending ? undefined : regenerate} onFileAction={handleFileAction} />
                ))}
                {sending && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 shrink-0 rounded flex items-center justify-center mt-1 bg-cyan-950 border border-cyan-400/30 text-cyan-400 glow-cyan">
                      <span className="font-display font-bold">T</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl bg-navy-950/80 border border-cyan-400/10 text-sm text-slate-400 rounded-tl-sm">
                      {runStatus ? <span className="animate-pulse">{runStatus}…</span> : <span>TECHY is thinking…</span>}
                      <button
                        onClick={stopGeneration}
                        className="flex items-center gap-1 text-[11px] font-mono text-red-400 hover:text-red-300 ml-4 transition-colors"
                      >
                        <Square size={11} className="fill-current" />
                        Stop
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-red-500/20 bg-red-950/20 text-xs text-red-300">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span className="truncate">{error}</span>
                </div>
                <HUDButton variant="ghost" size="sm" className="h-6 px-2 shrink-0" onClick={() => setError(null)}>
                  Dismiss
                </HUDButton>
              </div>
            )}

            {!initialLoading && replyNote && messages.length > 0 && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-amber-400/20 bg-amber-950/10 text-xs text-amber-400/90">
                <span className="min-w-0">{replyNote}</span>
                <HUDButton variant="ghost" size="sm" className="h-6 px-2 shrink-0" onClick={() => setReplyNote(null)}>
                  Dismiss
                </HUDButton>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 pt-2 bg-gradient-to-t from-navy-950 via-navy-950/90 to-transparent shrink-0">
          <div className="max-w-3xl mx-auto">
            <AIInput
              onSend={sendMessage}
              onAttach={handleAttach}
              onRemoveAttachment={handleRemoveAttachment}
              attachments={attachments}
              disabled={initialLoading || sending}
            />
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}