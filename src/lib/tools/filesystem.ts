import { ToolDefinition } from "@/types";

// TODO: Phase 5 - Implement real filesystem operations using Node.js fs module in the Local Agent

export const listFilesTool: ToolDefinition = {
  name: "list_files",
  description: "Lists files and directories in the specified path.",
  category: "filesystem",
  permissionLevel: "safe",
  parameters: {
    path: { type: "string", description: "The directory path to list" },
  },
  execute: async (params) => {
    console.log("[Tool: list_files]", params);
    return [{ name: "Documents", type: "directory" }, { name: "Downloads", type: "directory" }];
  }
};

export const readFileTool: ToolDefinition = {
  name: "read_file",
  description: "Reads the content of a file.",
  category: "filesystem",
  permissionLevel: "safe",
  parameters: {
    path: { type: "string", description: "The path of the file to read" },
  },
  execute: async (params) => {
    console.log("[Tool: read_file]", params);
    return "Simulated file content";
  }
};
