import { AICore } from "@/components/ai/AICore";
import { AIGreeting } from "@/components/ai/AIGreeting";
import { AIInput } from "@/components/ai/AIInput";
import { SystemMonitorPanel } from "@/components/dashboard/SystemMonitorPanel";
import { WeatherPanel } from "@/components/dashboard/WeatherPanel";
import { TaskPanel } from "@/components/dashboard/TaskPanel";
import { QuickAppsPanel } from "@/components/dashboard/QuickAppsPanel";
import { AIModelPanel } from "@/components/dashboard/AIModelPanel";
import { RecentActivityPanel } from "@/components/dashboard/RecentActivityPanel";
import { BriefingPanel } from "@/components/dashboard/BriefingPanel";

export default function Dashboard() {
  return (
    <div className="h-full flex flex-col xl:flex-row gap-6 animate-fade-in">
      
      {/* Left Column: AI Core (Takes priority on smaller screens) */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
          <AICore />
          <AIGreeting />
        </div>
        <div className="pb-8">
          <AIInput />
        </div>
      </div>

      {/* Right Column: Dashboard Panels */}
      <div className="w-full xl:w-[450px] 2xl:w-[500px] shrink-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 auto-rows-min content-start gap-6 overflow-y-auto pr-2 pb-8 h-[calc(100vh-8rem)]">

        <BriefingPanel />

        <SystemMonitorPanel />

        <WeatherPanel />

        <TaskPanel />

        <QuickAppsPanel />

        <AIModelPanel />

        <RecentActivityPanel />

      </div>
    </div>
  );
}
