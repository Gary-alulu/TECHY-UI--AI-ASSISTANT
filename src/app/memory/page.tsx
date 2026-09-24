import { MemoryInspector } from "@/components/memory/MemoryInspector";

export default function MemoryPage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">AI Conversation Memory Inspector</h2>
        <p className="text-sm text-slate-400 mt-1">
          See exactly what TECHY remembers about you — ask TECHY <span className="font-mono text-cyan-400/80">“What do you remember about me?”</span>
        </p>
      </div>
      <MemoryInspector />
    </div>
  );
}