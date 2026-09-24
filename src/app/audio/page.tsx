import { AudioIntelPanel } from "@/components/audio/AudioIntelPanel";

export default function AudioPage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Audio Intelligence</h2>
        <p className="text-sm text-slate-400 mt-1">
          Transcribe, separate speakers, summarize and extract action items — ask TECHY <span className="font-mono text-cyan-400/80">“What were the decisions in my call?”</span>
        </p>
      </div>
      <AudioIntelPanel />
    </div>
  );
}