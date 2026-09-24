import { MediaCenterPanel } from "@/components/media/MediaCenterPanel";

export default function MediaPage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Media Center</h2>
        <p className="text-sm text-slate-400 mt-1">
          Your music, videos and podcasts — ask TECHY <span className="font-mono text-cyan-400/80">“Play my design playlist”</span>
        </p>
      </div>
      <MediaCenterPanel />
    </div>
  );
}