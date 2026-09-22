"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AIStateInfo, AIModel, AppState } from "@/types";

interface AppContextType extends AppState {
  setSidebarCollapsed: (collapsed: boolean) => void;
  setAIState: (stateInfo: Partial<AIStateInfo>) => void;
  setActiveModel: (model: AIModel | null) => void;
  setTheme: (theme: "dark" | "light") => void;
  setIsOnline: (isOnline: boolean) => void;
  setIsLocalAIConnected: (isConnected: boolean) => void;
}

const defaultState: AppState = {
  sidebarCollapsed: false,
  aiState: {
    state: "idle",
    label: "TECHY is ready.",
  },
  activeModel: {
    id: "llama3",
    name: "Llama 3 8B",
    type: "chat",
    status: "active",
    provider: "Ollama",
    ramUsage: "4.5 GB",
    contextLength: 8192,
  },
  theme: "dark",
  isOnline: true,
  isLocalAIConnected: true,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(defaultState.sidebarCollapsed);
  const [aiState, setAIStateInternal] = useState<AIStateInfo>(defaultState.aiState);
  const [activeModel, setActiveModel] = useState<AIModel | null>(defaultState.activeModel);
  const [theme, setTheme] = useState(defaultState.theme);
  const [isOnline, setIsOnline] = useState(defaultState.isOnline);
  const [isLocalAIConnected, setIsLocalAIConnected] = useState(defaultState.isLocalAIConnected);

  const setAIState = (stateInfo: Partial<AIStateInfo>) => {
    setAIStateInternal((prev) => ({ ...prev, ...stateInfo }));
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsOnline(navigator.onLine));

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        sidebarCollapsed,
        setSidebarCollapsed,
        aiState,
        setAIState,
        activeModel,
        setActiveModel,
        theme,
        setTheme,
        isOnline,
        setIsOnline,
        isLocalAIConnected,
        setIsLocalAIConnected,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
