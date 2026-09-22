"use client";

import { useApp } from "@/context/AppContext";
import { AIState } from "@/types";

export function useAIState() {
  const { aiState, setAIState } = useApp();

  const transitionTo = (state: AIState, label?: string, details?: { model?: string; toolName?: string; detail?: string }) => {
    let defaultLabel = "TECHY is ready.";
    switch (state) {
      case "listening":
        defaultLabel = "Listening...";
        break;
      case "thinking":
        defaultLabel = "Thinking...";
        break;
      case "executing":
        defaultLabel = "Executing...";
        break;
      case "speaking":
        defaultLabel = "Speaking...";
        break;
      case "error":
        defaultLabel = "An error occurred.";
        break;
    }

    setAIState({
      state,
      label: label || defaultLabel,
      ...details,
    });
  };

  const simulateExecutionSequence = (taskLabel: string, durationMs: number = 3000) => {
    transitionTo("thinking", `Analyzing request: ${taskLabel}`);
    
    setTimeout(() => {
      transitionTo("executing", `Executing: ${taskLabel}`, { toolName: "SystemTool" });
      
      setTimeout(() => {
        transitionTo("idle", "TECHY is ready.");
      }, durationMs);
    }, 1500);
  };

  return {
    stateInfo: aiState,
    transitionTo,
    simulateExecutionSequence,
  };
}
