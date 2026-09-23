import { ActivityPanel } from "@/components/activity/ActivityPanel";

export default function ActivityPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Activity Log</h2>
        <p className="text-sm text-slate-400 mt-1">
          Complete visibility into what TECHY has done. Click any event for the full detail.
        </p>
      </div>
      <ActivityPanel />
    </div>
  );
}