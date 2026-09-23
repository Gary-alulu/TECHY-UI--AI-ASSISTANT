"use client";

import React, { useCallback, useEffect, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { HUDButton } from "../ui/HUDButton";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, TaskRepeat } from "@/types";

const PRIORITY_DOT: Record<Task["priority"], string> = {
  urgent: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]",
  high: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
  medium: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
  low: "bg-slate-500",
};

function formatRemindAt(value: Date): string {
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay(value, now)) return `today ${time}`;
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(value, tomorrow)) return `tomorrow ${time}`;
  return `${value.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ${time}`;
}

export function TaskPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [remindInput, setRemindInput] = useState("");
  const [repeatInput, setRepeatInput] = useState<TaskRepeat>("none");
  const [priorityInput, setPriorityInput] = useState<Task["priority"]>("medium");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tasks", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { tasks: Task[]; error?: string };
      if (data.error) throw new Error(data.error);
      setTasks(data.tasks ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      load();
    });
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const submitTask = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = titleInput.trim();
    if (!title || creating) return;

    setCreating(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: descriptionInput.trim() || undefined,
          remindAt: remindInput ? new Date(remindInput).toISOString() : undefined,
          repeat: repeatInput === "none" ? undefined : repeatInput,
          priority: priorityInput,
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { task: Task };
      setTasks((previous) => [...previous, data.task]);
      setTitleInput("");
      setDescriptionInput("");
      setRemindInput("");
      setRepeatInput("none");
      setPriorityInput("medium");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task");
    } finally {
      setCreating(false);
    }
  };

  const toggleTask = async (task: Task) => {
    const nextStatus = task.status === "completed" ? "todo" : "completed";
    const pending: Task = { ...task, status: nextStatus };
    setTasks((previous) => previous.map((entry) => (entry.id === task.id ? pending : entry)));

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
    } catch (err) {
      setTasks((previous) => previous.map((entry) => (entry.id === task.id ? task : entry)));
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  };

  const removeTask = async (task: Task) => {
    if (deletingId) return;
    setDeletingId(task.id);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE", cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setTasks((previous) => previous.filter((entry) => entry.id !== task.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setDeletingId(null);
    }
  };

  const completedCount = tasks.filter((task) => task.status === "completed").length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <GlassPanel
      header="Tasks & Reminders"
      className="h-full flex flex-col"
      headerAction={
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500">
            {completedCount}/{tasks.length}
          </span>
          <HUDButton
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-cyan-400"
            onClick={() => setFormOpen((open) => !open)}
            aria-label="Add task"
          >
            <Plus size={14} />
          </HUDButton>
        </div>
      }
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-400 transition-all duration-500 rounded-full glow-cyan"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-mono text-cyan-400">{progress}%</span>
      </div>

      {error && (
        <div className="mb-3 flex items-center justify-between gap-2 p-2.5 rounded-lg border border-red-500/20 bg-red-950/20 text-xs text-red-300">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={13} className="shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <HUDButton variant="ghost" size="sm" className="h-6 px-2 shrink-0" onClick={load}>
            Retry
          </HUDButton>
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={submitTask}
          className="mb-3 flex flex-col gap-2 p-2.5 rounded-lg border border-cyan-400/20 bg-cyan-950/10"
        >
          <input
            value={titleInput}
            onChange={(event) => setTitleInput(event.target.value)}
            placeholder="Task title"
            maxLength={200}
            className="w-full min-w-0 bg-navy-950/50 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/40"
          />
          <input
            value={descriptionInput}
            onChange={(event) => setDescriptionInput(event.target.value)}
            placeholder="Description (optional)"
            maxLength={400}
            className="w-full min-w-0 bg-navy-950/50 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/40"
          />
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2">
            <input
              type="datetime-local"
              value={remindInput}
              onChange={(event) => setRemindInput(event.target.value)}
              title="Remind me at this time"
              className="bg-navy-950/50 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-400/40 color-scheme-dark"
            />
            <select
              value={repeatInput}
              onChange={(event) => setRepeatInput(event.target.value as TaskRepeat)}
              title="Repeat"
              className="bg-navy-950/50 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/40"
            >
              <option value="none">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <select
              value={priorityInput}
              onChange={(event) => setPriorityInput(event.target.value as Task["priority"])}
              className="bg-navy-950/50 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/40"
            >
              <option value="low">Low</option>
              <option value="medium">Med</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <HUDButton type="submit" size="sm" className="h-8 px-3" disabled={!titleInput.trim() || creating}>
              {creating ? <Loader2 size={14} className="animate-spin" /> : "Add"}
            </HUDButton>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2 min-h-0">
        {loading && !formOpen && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-800/50 animate-pulse">
                <div className="w-4 h-4 rounded-full bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 bg-slate-800 rounded" />
                  <div className="h-2.5 w-1/4 bg-slate-800/70 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center text-slate-500">
            <div className="w-12 h-12 rounded-full border border-slate-800 bg-navy-950/50 flex items-center justify-center">
              <Clock size={18} className="text-slate-600" />
            </div>
            <p className="text-sm text-slate-500">No tasks yet.</p>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400/70">
              <Plus size={12} />
              <span>Add one with the + button</span>
            </div>
          </div>
        )}

        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              "group flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer",
              task.status === "completed"
                ? "bg-emerald-950/20 border-emerald-500/10 opacity-70"
                : "bg-navy-950/50 border-slate-800 hover:border-cyan-400/30 hover:bg-cyan-950/20"
            )}
            onClick={() => toggleTask(task)}
          >
            <button
              className="mt-0.5 shrink-0 text-slate-400 group-hover:text-cyan-400 transition-colors"
              aria-label={task.status === "completed" ? "Mark as pending" : "Mark as done"}
            >
              {task.status === "completed" ? (
                <CheckCircle2 size={16} className="text-emerald-500" />
              ) : (
                <Circle size={16} />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-sm font-medium truncate transition-all",
                  task.status === "completed" ? "text-slate-400 line-through" : "text-slate-200"
                )}
              >
                {task.title}
              </p>
              {task.description && (
                <p
                  className={cn(
                    "text-xs mt-0.5 line-clamp-2 leading-snug",
                    task.status === "completed" ? "text-slate-600" : "text-slate-500"
                  )}
                >
                  {task.description}
                </p>
              )}
              {task.remindAt ? (
                <div className="flex items-center gap-1 mt-1 text-xs text-cyan-400/80 font-mono">
                  <Bell size={10} />
                  <span>{formatRemindAt(task.remindAt)}</span>
                  {task.repeat && task.repeat !== "none" && (
                    <span className="flex items-center gap-0.5 text-[9px] uppercase tracking-wider text-cyan-500/60">
                      <Repeat size={9} />
                      {task.repeat}
                    </span>
                  )}
                </div>
              ) : task.dueTime ? (
                <div className="flex items-center gap-1 mt-1 text-xs text-slate-500 font-mono">
                  <Clock size={10} />
                  <span>{task.dueTime}</span>
                </div>
              ) : null}
            </div>

            {task.status !== "completed" && (
              <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", PRIORITY_DOT[task.priority])} />
            )}

            <button
              className="mt-0.5 shrink-0 text-slate-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
              onClick={(event) => {
                event.stopPropagation();
                removeTask(task);
              }}
              aria-label={`Delete ${task.title}`}
            >
              {deletingId === task.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
            </button>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}