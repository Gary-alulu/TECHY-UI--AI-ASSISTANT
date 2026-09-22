"use client";

import React, { useRef, useState } from "react";
import { Mic, Send, Paperclip, X, FileText } from "lucide-react";
import { HUDButton } from "../ui/HUDButton";
import { useAIState } from "@/hooks/useAIState";
import { useRouter } from "next/navigation";
import { cn, formatBytes } from "@/lib/utils";
import type { FileAttachment } from "@/types";

interface AIInputProps {
  onSend?: (text: string) => void | Promise<void>;
  onAttach?: (files: File[]) => void;
  onRemoveAttachment?: (id: string) => void;
  attachments?: FileAttachment[];
  disabled?: boolean;
  placeholder?: string;
}

export function AIInput({ onSend, onAttach, onRemoveAttachment, attachments, disabled, placeholder }: AIInputProps) {
  const [input, setInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { stateInfo, transitionTo } = useAIState();
  const isListening = stateInfo.state === "listening";
  const inputDisabled = disabled === true || !(stateInfo.state === "idle" || stateInfo.state === "error");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || inputDisabled) return;

    setInput("");
    if (onSend) {
      await onSend(text);
    } else {
      router.push(`/chat?q=${encodeURIComponent(text)}`);
    }
  };

  const toggleListen = () => {
    if (isListening) {
      transitionTo("idle");
    } else {
      transitionTo("listening", "Listening for wake word or command...");
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const slice = Array.from(files).slice(0, 8);
    onAttach?.(slice);
  };

  return (
    <div className="w-full max-w-2xl mx-auto relative z-20">
      {attachments && attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((attachment) => (
            <span
              key={attachment.id}
              className="flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-lg bg-navy-950/80 border border-cyan-400/25 text-[11px] text-slate-300 font-mono"
            >
              <FileText size={12} className="text-cyan-400 shrink-0" />
              <span className="max-w-[150px] truncate">{attachment.name}</span>
              <span className="text-slate-500 shrink-0">{formatBytes(attachment.size)}</span>
              <button
                onClick={() => onRemoveAttachment?.(attachment.id)}
                className="text-slate-500 hover:text-rose-400 transition-colors p-0.5"
                aria-label={`Remove ${attachment.name}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "relative group transition-all duration-300",
          dragging && "ring-2 ring-cyan-400/60 rounded-xl"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Glow effect on focus/hover */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/0 via-cyan-500/30 to-cyan-500/0 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />

        <div
          className={cn(
            "relative flex items-center bg-navy-950/80 backdrop-blur-xl border border-cyan-400/20 rounded-xl p-2 shadow-2xl overflow-hidden transition-all duration-300 group-focus-within:border-cyan-400/50 group-focus-within:shadow-[0_0_20px_rgba(34,211,238,0.15)]",
            dragging && "border-cyan-400/60"
          )}
        >
          {dragging && (
            <span className="absolute inset-0 flex items-center justify-center text-xs font-mono text-cyan-300 bg-navy-950/85 backdrop-blur-sm z-10">
              Drop files to attach
            </span>
          )}

          <HUDButton
            type="button"
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-cyan-400 shrink-0 rounded-lg"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={18} />
          </HUDButton>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder ?? "Ask TECHY to find a file, open an app, or analyze system data..."}
            className="flex-1 bg-transparent border-none text-slate-100 text-sm px-3 py-3 focus:outline-none focus:ring-0 placeholder:text-slate-500"
            disabled={inputDisabled}
          />

          <div className="flex items-center gap-2 pr-1 shrink-0">
            <HUDButton
              type="button"
              variant={isListening ? "default" : "ghost"}
              size="icon"
              className={cn(
                "rounded-lg transition-all duration-300",
                isListening ? "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-400/50" : "text-slate-400 hover:text-cyan-400"
              )}
              onClick={toggleListen}
            >
              <Mic size={18} className={isListening ? "animate-pulse" : ""} />
            </HUDButton>

            <HUDButton
              type="submit"
              variant={input.trim() ? "default" : "outline"}
              size="icon"
              className="rounded-lg h-10 w-10 shrink-0"
              disabled={!input.trim() || inputDisabled}
            >
              <Send size={16} className={input.trim() ? "translate-x-0.5" : ""} />
            </HUDButton>
          </div>

          {/* Scan line effect inside input */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-400/0 group-focus-within:animate-[scan-line_4s_linear_infinite]" />
        </div>
      </form>

      {/* Keyboard hints */}
      <div className="flex justify-center gap-6 mt-4 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
          <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Enter</kbd>
          <span>to send</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
          <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">⇧</kbd>
          <span>+</span>
          <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Enter</kbd>
          <span>for new line</span>
        </div>
      </div>
    </div>
  );
}