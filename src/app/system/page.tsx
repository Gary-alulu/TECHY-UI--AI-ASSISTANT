import { SystemCommandCenter } from "@/components/system/SystemCommandCenter";
import { ProcessListPanel } from "@/components/system/ProcessListPanel";
import { NetworkTrafficPanel } from "@/components/system/NetworkTrafficPanel";
import { StartupAppsPanel } from "@/components/system/StartupAppsPanel";

export default function SystemPage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">System Command Center</h2>
        <p className="text-sm text-slate-400 mt-1">
          Live machine status — ask TECHY <span className="font-mono text-cyan-400/80">“What’s using the most RAM?”</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[760px] grid-rows-[minmax(0,1fr)]">
        <div className="lg:col-span-1 min-h-0">
          <SystemCommandCenter />
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
          <div className="flex-1 min-h-0">
            <ProcessListPanel />
          </div>
          <div className="grid grid-cols-2 gap-6 h-56 min-h-0">
            <StartupAppsPanel />
            <NetworkTrafficPanel />
          </div>
        </div>
      </div>
    </div>
  );
}