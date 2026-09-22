import { QuickAppsPanel } from "@/components/dashboard/QuickAppsPanel";
import { InstalledAppsPanel } from "@/components/apps/InstalledAppsPanel";

export default function AppsPage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Applications</h2>
        <p className="text-sm text-slate-400 mt-1">Browse and launch installed applications on this machine.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px] grid-rows-[minmax(0,1fr)]">
        <div className="lg:col-span-2 min-h-0">
          <InstalledAppsPanel />
        </div>
        
        <div className="min-h-0">
          <QuickAppsPanel />
        </div>
      </div>
    </div>
  );
}