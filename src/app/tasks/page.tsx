import { TaskPanel } from "@/components/dashboard/TaskPanel";

export default function TasksPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Tasks & Workflows</h2>
        <p className="text-sm text-slate-400 mt-1">Manage automated workflows and daily reminders.</p>
      </div>
      <div className="h-[600px] w-full max-w-2xl">
        <TaskPanel />
      </div>
    </div>
  );
}
