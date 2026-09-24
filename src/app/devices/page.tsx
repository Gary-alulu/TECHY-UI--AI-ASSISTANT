import { DevicesPanel } from "@/components/devices/DevicesPanel";

export default function DevicesPage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Device Manager</h2>
        <p className="text-sm text-slate-400 mt-1">
          Track your keyboard, mouse, headphones, webcam and more — ask TECHY <span className="font-mono text-cyan-400/80">“Is my headset connected?”</span>
        </p>
      </div>
      <DevicesPanel />
    </div>
  );
}