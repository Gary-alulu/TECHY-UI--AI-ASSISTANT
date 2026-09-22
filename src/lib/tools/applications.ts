import { ToolDefinition } from "@/types";

// TODO: Phase 7 - Implement real application launching

export const launchAppTool: ToolDefinition = {
  name: "launch_app",
  description: "Opens an application by name or path.",
  category: "applications",
  permissionLevel: "safe", // Often safe, but might require confirmation for unfamiliar apps
  parameters: {
    appName: { type: "string", description: "Name of the application to open" },
  },
  execute: async (params) => {
    console.log("[Tool: launch_app]", params);
    return { success: true, message: `Simulated launching ${params.appName}` };
  }
};

export const closeAppTool: ToolDefinition = {
  name: "close_app",
  description: "Closes a running application.",
  category: "applications",
  permissionLevel: "confirmation_required", // Dangerous as it might lose unsaved work
  parameters: {
    appName: { type: "string", description: "Name of the application to close" },
  },
  execute: async (params) => {
    console.log("[Tool: close_app]", params);
    return { success: true, message: `Simulated closing ${params.appName}` };
  }
};
