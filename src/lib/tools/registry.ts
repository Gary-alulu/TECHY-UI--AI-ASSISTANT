import { ToolDefinition } from "@/types";

/**
 * Tool Registry
 * Manages the available tools that the AI can call.
 */
class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition) {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool ${tool.name} is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getToolsByCategory(category: string): ToolDefinition[] {
    return this.getAllTools().filter(tool => tool.category === category);
  }

  async executeTool(name: string, params: Record<string, unknown>): Promise<unknown> {
    const tool = this.getTool(name);
    
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    console.log(`[ToolRegistry] Executing ${name} with params:`, params);
    
    // In Phase 4, permission checking happens here before execute()
    
    try {
      const result = await tool.execute(params);
      return result;
    } catch (error) {
      console.error(`[ToolRegistry] Error executing ${name}:`, error);
      throw error;
    }
  }
}

export const toolRegistry = new ToolRegistry();
