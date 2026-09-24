import { HealthPanel } from "@/components/health/HealthPanel";

export default function HealthPage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Self-Diagnostics</h2>
        <p className="text-sm text-slate-400 mt-1">
          A transparent health score for this machine — ask TECHY <span className="font-mono text-cyan-400/80">“How healthy is my system?”</span>
        </p>
      </div>
      <HealthPanel />
    </div>
  );
}