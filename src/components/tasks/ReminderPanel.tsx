"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import {
  AlarmClock,
  Bell,
  BellRing,
  CheckCircle2,
  Loader2,
  Repeat,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DueReminder {
  id: string;
  taskId: string;
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  scheduledFor: string;
  firedAt: string;
  minutesAgo: number;
}

interface UpcomingReminder {
  taskId: string;
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  remindAt: string;
  repeat?: "daily" | "weekly" | "monthly";
  minutesUntil: number;
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-slate-500",
};

function timeLabel(value: Date): string {
  return value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function aboutLabel(minutes: number): string {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ~${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `in ~${hours}h` : `in ~${Math.round(hours / 24)}d`;
}

export function ReminderPanel() {
  const [due, setDue] = useState<DueReminder[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<Set<string>>(new Set());
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const seenIds = useRef<Set<string>>(new Set());

  const load = useCallback(async (notify = false) => {
    try {
      const response = await fetch("/api/tasks/reminders", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { due: DueReminder[]; upcoming: UpcomingReminder[] };
      setDue(data.due ?? []);
      setUpcoming(data.upcoming ?? []);
      setError(null);

      if (notify && notificationsOn && permission === "granted" && typeof Notification !== "undefined") {
        for (const reminder of data.due ?? []) {
          if (seenIds.current.has(reminder.id)) continue;
          seenIds.current.add(reminder.id);
          try {
            new Notification(`⏰ ${reminder.title}`, {
              body: `${timeLabel(new Date(reminder.firedAt))} — task reminder`,
              tag: reminder.id,
            });
          } catch {
            // notifications unsupported
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reminders");
    } finally {
      setLoading(false);
    }
  }, [notificationsOn, permission]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => load(true));
    const interval = setInterval(() => load(true), 15_000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, [load]);

  const toggleNotifications = async () => {
    if (typeof Notification === "undefined") {
      setError("This browser does not support notifications.");
      return;
    }
    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      setPermission(result);
      setNotificationsOn(result === "granted");
      if (result === "granted") {
        seenIds.current.clear();
        await load(true);
      }
    } else {
      setNotificationsOn((previous) => {
        const next = !previous;
        if (next) seenIds.current.clear();
        return next;
      });
    }
  };

  const completeTask = async (reminder: DueReminder) => {
    setActions((previous) => new Set(previous).add(reminder.taskId));
    try {
      await fetch(`/api/tasks/${reminder.taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
        cache: "no-store",
      });
      await dismiss(reminder.taskId);
    } catch {
      setError("Failed to update the task.");
    } finally {
      setActions((previous) => {
        const next = new Set(previous);
        next.delete(reminder.taskId);
        return next;
      });
    }
  };

  const dismiss = async (taskId: string) => {
    try {
      await fetch("/api/tasks/reminders/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
        cache: "no-store",
      });
      await load();
    } catch {
      setError("Failed to dismiss the reminder.");
    }
  };

  return (
    <GlassPanel
      header="Reminders"
      className="h-full flex flex-col"
      headerAction={
        <button
          type="button"
          onClick={toggleNotifications}
          title="Browser notifications for scheduled reminders"
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-mono uppercase tracking-widest border transition-colors",
            notificationsOn && permission === "granted"
              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
              : "border-slate-800/60 bg-navy-950/40 text-slate-400 hover:text-cyan-300"
          )}
        >
          {notificationsOn && permission === "granted" ? <BellRing size={11} /> : <Bell size={11} />}
          Notifications {notificationsOn && permission === "granted" ? "On" : "Off"}
        </button>
      }
    >
      <div className="flex flex-col h-full min-h-0 gap-3">
        {error && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[10px] font-mono text-rose-400 shrink-0">
            <AlertTriangle size={12} className="shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
          {/* Due now */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-mono uppercase tracking-widest text-amber-400">Due now</span>
              {loading && <Loader2 size={11} className="animate-spin text-slate-600" />}
            </div>
            {due.length === 0 && !loading && (
              <p className="text-[11px] font-mono text-slate-700 px-1">All caught up.</p>
            )}
            {due.map((reminder) => {
              const busy = actions.has(reminder.taskId);
              return (
                <div
                  key={reminder.id}
                  className="flex items-start gap-2.5 p-2.5 mb-2 rounded-lg border border-amber-400/20 bg-amber-950/10"
                >
                  <AlarmClock size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-200 truncate">{reminder.title}</div>
                    <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 mt-0.5">
                      <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY_DOT[reminder.priority] ?? "bg-slate-500")} />
                      {reminder.minutesAgo <= 1 ? "just now" : `${reminder.minutesAgo} min ago`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => completeTask(reminder)}
                      disabled={busy}
                      title="Mark task done"
                      className="p-1 rounded-md text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(reminder.taskId)}
                      disabled={busy}
                      title="Dismiss reminder"
                      className="p-1 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Upcoming */}
          <div>
            <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-400">Upcoming</span>
            {upcoming.length === 0 && !loading && (
              <p className="text-[11px] font-mono text-slate-700 px-1 mt-1">
                No scheduled reminders. Ask TECHY: “remind me tomorrow at 9 to call Sam”.
              </p>
            )}
            <div className="mt-1.5 space-y-1.5">
              {upcoming.map((reminder) => (
                <div
                  key={reminder.taskId}
                  className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-800/50 bg-navy-950/40"
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_DOT[reminder.priority] ?? "bg-slate-500")} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-300 truncate">{reminder.title}</div>
                    <div className="text-[9px] font-mono text-slate-600">
                      {aboutLabel(reminder.minutesUntil)} · {timeLabel(new Date(reminder.remindAt))}
                    </div>
                  </div>
                  {reminder.repeat && (
                    <span className="flex items-center gap-1 text-[9px] font-mono uppercase text-cyan-500/70 shrink-0">
                      <Repeat size={10} />
                      {reminder.repeat}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}