import { TaskPanel } from "@/components/dashboard/TaskPanel";
import { ReminderPanel } from "@/components/tasks/ReminderPanel";

export default function TasksPage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Tasks & Reminders</h2>
        <p className="text-sm text-slate-400 mt-1">
          Manage tasks and scheduled reminders — ask TECHY <span className="font-mono text-cyan-400/80">“remind me tomorrow at 9 to call Sam”</span>
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        <div className="lg:col-span-2 min-h-0">
          <TaskPanel />
        </div>
        <div className="lg:col-span-1 min-h-0">
          <ReminderPanel />
        </div>
      </div>
    </div>
  );
}