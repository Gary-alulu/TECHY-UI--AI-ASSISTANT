"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Trash2, Loader2 } from "lucide-react";
import type { AppNotification, NotificationKind } from "@/types";

const KIND_STYLE: Record<NotificationKind, { color: string; label: string }> = {
  new_file: { color: "#34d399", label: "FILE" },
  meeting: { color: "#a78bfa", label: "MEETING" },
  task_overdue: { color: "#fb7185", label: "TASK" },
  download: { color: "#38bdf8", label: "DOWNLOAD" },
  ai_task: { color: "#22d3ee", label: "AI" },
  storage: { color: "#fbbf24", label: "STORAGE" },
  crash: { color: "#ef4444", label: "CRASH" },
  automation: { color: "#818cf8", label: "AUTO" },
  briefing: { color: "#2dd4bf", label: "BRIEFING" },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=20", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { notifications: AppNotification[]; unread: number };
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      // server not ready
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => load(true));
    const interval = setInterval(() => load(true), 30_000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const markAll = async () => {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    await load();
  };

  const clearAll = async () => {
    await fetch("/api/notifications", { method: "DELETE" });
    await load();
  };

  const markOne = async (id: string) => {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await load();
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) load();
        }}
        className="relative p-2 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-cyan-950/30 transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-2.5 h-2.5 px-0.5 rounded-full bg-cyan-500 text-[8px] font-mono text-navy-950 flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 md:w-96 rounded-xl glass-panel border border-cyan-400/20 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 bg-navy-950/60">
            <span className="text-display text-[10px] font-mono uppercase tracking-widest text-cyan-400">
              TECHY Notifications{unread > 0 ? ` · ${unread} new` : ""}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={markAll} className="p-1.5 rounded text-slate-500 hover:text-cyan-300 hover:bg-slate-800/50" title="Mark all read">
                <CheckCheck size={14} />
              </button>
              <button type="button" onClick={clearAll} className="p-1.5 rounded text-slate-500 hover:text-rose-300 hover:bg-slate-800/50" title="Clear all">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="p-6 flex justify-center text-slate-600">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-[11px] font-mono text-slate-700">No notifications yet.</p>
            ) : (
              items.map((notification) => {
                const style = KIND_STYLE[notification.kind] ?? KIND_STYLE.ai_task;
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => { if (!notification.read) markOne(notification.id); }}
                    className={`w-full text-left p-3 flex gap-2.5 transition-colors border-b border-slate-800/40 ${notification.read ? "bg-navy-950/30 opacity-70" : "bg-navy-950/60 hover:bg-cyan-950/20"}`}
                  >
                    <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: style.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-200 truncate">{notification.title}</span>
                        <span className="text-[8px] font-mono text-slate-600 shrink-0">{style.label}</span>
                      </div>
                      {notification.body && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-2">{notification.body}</p>}
                      <p className="text-[9px] font-mono text-slate-600 mt-1">
                        {new Date(notification.createdAt).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}