import { NetworkIntelPanel } from "@/components/network/NetworkIntelPanel";

export default function NetworkPage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Network Intelligence</h2>
        <p className="text-sm text-slate-400 mt-1">
          Live throughput, adapters, latency and LAN neighbors — ask TECHY <span className="font-mono text-cyan-400/80">“Who is on my network?”</span>
        </p>
      </div>
      <NetworkIntelPanel />
    </div>
  );
}