import { SafeModePanel } from "@/components/safemode/SafeModePanel";

export default function SafeModePage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Emergency / Safe Mode</h2>
        <p className="text-sm text-slate-400 mt-1">
          Lock down computer control when you need a break — ask TECHY <span className="font-mono text-cyan-400/80">“Enter safe mode”</span>
        </p>
      </div>
      <SafeModePanel />
    </div>
  );
}