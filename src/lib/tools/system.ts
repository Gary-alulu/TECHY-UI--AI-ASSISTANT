import { ToolDefinition } from "@/types";

// TODO: Phase 6 - Implement real system monitoring using Node.js os module/systeminformation

export const getSystemStatusTool: ToolDefinition = {
  name: "get_system_status",
  description: "Retrieves current CPU, RAM, and Disk usage.",
  category: "system",
  permissionLevel: "safe",
  parameters: {},
  execute: async () => {
    console.log("[Tool: get_system_status]");
    return {
      cpu: "15%",
      ram: "45%",
      disk: "60%"
    };
  }
};

export const getRunningProcessesTool: ToolDefinition = {
  name: "get_running_processes",
  description: "Lists currently running processes.",
  category: "system",
  permissionLevel: "safe",
  parameters: {},
  execute: async () => {
    console.log("[Tool: get_running_processes]");
    return ["chrome.exe", "code.exe", "node.exe"];
  }
};
