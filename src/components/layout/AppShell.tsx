"use client";

import React, { useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CommandMode } from "../command/CommandMode";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, setSidebarCollapsed } = useApp();
  const isMobile = useIsMobile();

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
  }, [isMobile, sidebarCollapsed, setSidebarCollapsed]);

  return (
    <div className="flex h-screen w-full bg-navy-950 overflow-hidden bg-circuit selection:bg-cyan-900/50">
      {/* Background radial gradient */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-radial" />
      
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <div
        className={cn(
          "flex flex-col flex-1 h-full min-w-0 transition-all duration-300 ease-in-out relative z-10",
          sidebarCollapsed ? "ml-[60px]" : "ml-64",
          isMobile && "ml-[60px]"
        )}
      >
        <TopBar />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 relative">
          <div className="max-w-[1920px] mx-auto h-full">
            {children}
          </div>
        </main>
      </div>

      {/* Global Command Mode */}
      <CommandMode />
    </div>
  );
}
