import { GlassPanel } from "@/components/ui/GlassPanel";
import { Mic, Volume2 } from "lucide-react";

export default function VoicePage() {
  return (
    <div className="h-[calc(100vh-8rem)] flex items-center justify-center animate-fade-in">
      <div className="flex flex-col items-center gap-12 w-full max-w-lg">
        
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-display font-medium text-slate-100 tracking-wide">
            Voice Interface
          </h2>
          <p className="text-slate-400 font-mono text-sm uppercase tracking-widest">
            Ready to listen
          </p>
        </div>

        {/* Giant Voice Orb */}
        <div className="relative w-64 h-64 flex items-center justify-center">
          {/* Animated rings */}
          <div className="absolute inset-0 rounded-full border border-cyan-400/20 animate-[rotate-slow_10s_linear_infinite]" />
          <div className="absolute inset-4 rounded-full border-t border-cyan-400/40 animate-[rotate-slow_8s_linear_infinite_reverse]" />
          
          {/* Core button */}
          <button className="relative z-10 w-32 h-32 rounded-full bg-cyan-950/80 border border-cyan-400/50 flex items-center justify-center glow-cyan hover:glow-cyan-strong hover:scale-105 transition-all duration-300 group">
            <Mic size={40} className="text-cyan-400 group-hover:scale-110 transition-transform" />
            <div className="absolute inset-0 rounded-full bg-cyan-400/10 animate-pulse-glow" />
          </button>
        </div>

        {/* Audio Waveform Placeholder */}
        <div className="h-16 w-full max-w-sm flex items-center justify-center gap-1">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className="w-1.5 bg-cyan-900 rounded-full" 
              style={{ height: '4px' }} 
            />
          ))}
        </div>

        <GlassPanel padding="sm" className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <Volume2 size={16} className="text-cyan-400" />
            <span>Voice feedback enabled</span>
          </div>
          <div className="w-12 h-6 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center p-1 cursor-pointer">
            <div className="w-4 h-4 rounded-full bg-cyan-400 translate-x-6" />
          </div>
        </GlassPanel>

      </div>
    </div>
  );
}
