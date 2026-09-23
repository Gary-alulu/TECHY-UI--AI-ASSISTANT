import { OfflineStatusPanel } from "@/components/offline/OfflineStatusPanel";

export default function OfflinePage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Offline-First Mode</h2>
        <p className="text-sm text-slate-400 mt-1">
          TECHY runs locally. When the internet drops, the core keeps working — Local AI, files, system monitoring, applications, tasks, local memory and documents.
        </p>
      </div>
      <OfflineStatusPanel />
    </div>
  );
}