import { MeetingsPanel } from "@/components/meetings/MeetingsPanel";

export default function MeetingsPage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Meeting Assistant</h2>
        <p className="text-sm text-slate-400 mt-1">
          Plan, run and follow up on meetings — ask TECHY <span className="font-mono text-cyan-400/80">“Summarize my meeting notes”</span>
        </p>
      </div>
      <MeetingsPanel />
    </div>
  );
}