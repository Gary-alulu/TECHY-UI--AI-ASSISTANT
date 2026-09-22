import { SystemMonitorPanel } from "@/components/dashboard/SystemMonitorPanel";
import { ProcessListPanel } from "@/components/system/ProcessListPanel";
import { NetworkTrafficPanel } from "@/components/system/NetworkTrafficPanel";

export default function SystemPage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">System Monitoring</h2>
        <p className="text-sm text-slate-400 mt-1">Detailed hardware and network diagnostics.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[700px] grid-rows-[minmax(0,1fr)]">
        <div className="lg:col-span-1 min-h-0">
          <SystemMonitorPanel />
        </div>
        
        <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
          <ProcessListPanel />
          <NetworkTrafficPanel />
        </div>
      </div>
    </div>
  );
}
