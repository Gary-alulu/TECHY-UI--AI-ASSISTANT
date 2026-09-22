"use client";

import React, { useEffect, useState } from "react";
import { Message } from "@/types";
import { cn } from "@/lib/utils";
import { ToolExecutionCard } from "./ToolExecutionCard";
import { Markdown } from "./Markdown";
import { FileActionCards } from "./FileActionCard";
import { Check, Copy, FileText, RefreshCw, User } from "lucide-react";
import { HUDButton } from "../ui/HUDButton";
import { formatBytes } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
  onCopy?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  onFileAction?: (path: string, action: "summarize" | "analyze") => void;
}

export function MessageBubble({ message, onCopy, onRegenerate, onFileAction }: MessageBubbleProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      onCopy?.(message.id);
    } catch {
      // clipboard unavailable
    }
  };

  if (isSystem) {
    return (
      <div className="flex justify-center my-6">
        <span className="px-3 py-1 bg-slate-800/50 rounded-full border border-slate-700/50 text-xs font-mono text-slate-400 uppercase tracking-wider">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("group flex gap-4 max-w-[85%]", isUser ? "ml-auto flex-row-reverse" : "")}>
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 shrink-0 rounded flex items-center justify-center mt-1",
          isUser
            ? "bg-slate-800 border border-slate-700 text-slate-400"
            : "bg-cyan-950 border border-cyan-400/30 text-cyan-400 glow-cyan"
        )}
      >
        {isUser ? <User size={16} /> : <span className="font-display font-bold">T</span>}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-2 min-w-0", isUser ? "items-end" : "items-start")}>
        {/* Timestamp & Name */}
        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
          <span>{isUser ? "You" : "TECHY"}</span>
          <span>•</span>
          <span>{mounted ? message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
        </div>

        {/* Attachments (user) */}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-end max-w-sm">
            {message.attachments.map((attachment) => (
              <span
                key={attachment.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-[11px] text-indigo-200 font-mono"
              >
                <FileText size={12} className="text-indigo-300 shrink-0" />
                <span className="truncate max-w-[140px]">{attachment.name}</span>
                <span className="text-indigo-400/70 shrink-0">{formatBytes(attachment.size)}</span>
              </span>
            ))}
          </div>
        )}

        {/* Message Body */}
        <div
          className={cn(
            "px-5 py-3.5 rounded-2xl whitespace-pre-wrap text-[15px] leading-relaxed shadow-sm",
            isUser
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : "bg-navy-950/80 border border-cyan-400/10 text-slate-200 rounded-tl-sm backdrop-blur-md"
          )}
        >
          {isUser ? message.content : <Markdown content={message.content} />}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-cyan-400 animate-pulse rounded-sm" />
          )}
        </div>

        {/* File action cards (assistant) */}
        {!isUser && !message.isStreaming && <FileActionCards content={message.content} onAction={onFileAction} />}

        {/* Tool execution reports */}
        {!isUser && message.toolExecutions && message.toolExecutions.length > 0 && (
          <div className="mt-1 w-full max-w-sm space-y-2">
            {message.toolExecutions.map((execution) => (
              <ToolExecutionCard key={execution.id} execution={execution} />
            ))}
          </div>
        )}
        {!isUser && message.toolExecution && !message.toolExecutions && (
          <div className="mt-1 w-full max-w-sm">
            <ToolExecutionCard execution={message.toolExecution} />
          </div>
        )}

        {/* Assist actions */}
        {!isUser && (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <HUDButton variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-slate-400 hover:text-cyan-400" onClick={copy} disabled={!message.content}>
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </HUDButton>
            {onRegenerate && (
              <HUDButton variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-slate-400 hover:text-cyan-400" onClick={() => onRegenerate(message.id)} disabled={message.isStreaming}>
                <RefreshCw size={12} />
                Regenerate
              </HUDButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}