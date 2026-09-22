import { AIModelPanel } from "@/components/dashboard/AIModelPanel";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Settings as SettingsIcon, Shield, Server, Monitor } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Settings</h2>
        <p className="text-sm text-slate-400 mt-1">Configure TECHY and local integrations.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[700px]">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <GlassPanel className="h-full p-4">
            <nav className="space-y-2">
              <a href="#" className="flex items-center gap-3 px-3 py-2 bg-cyan-950/30 text-cyan-400 rounded-md border border-cyan-400/20">
                <Server size={18} />
                <span className="text-sm font-medium">AI Provider</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 rounded-md">
                <Shield size={18} />
                <span className="text-sm font-medium">Permissions</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 rounded-md">
                <Monitor size={18} />
                <span className="text-sm font-medium">Appearance</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 rounded-md">
                <SettingsIcon size={18} />
                <span className="text-sm font-medium">General</span>
              </a>
            </nav>
          </GlassPanel>
        </div>
        
        {/* Main Content */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div>
            <AIModelPanel />
          </div>
          
          <GlassPanel header="Local API Settings" className="flex-1">
             <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Ollama Endpoint</label>
                    <input type="text" defaultValue="http://localhost:11434" className="w-full bg-navy-950/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Default Model</label>
                    <select className="w-full bg-navy-950/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 appearance-none">
                      <option>llama3:8b</option>
                      <option>mistral:7b</option>
                      <option>phi3:mini</option>
                    </select>
                  </div>
                </div>
                
                <div className="pt-6 border-t border-slate-800/50">
                  <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors">
                    Save Changes
                  </button>
                </div>
             </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
