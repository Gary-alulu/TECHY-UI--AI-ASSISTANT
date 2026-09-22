import { AIModel, Message } from "@/types";
import { AIProviderService } from "./provider";

/**
 * Ollama Provider Implementation
 * TODO: Phase 3 - Implement actual API calls to local Ollama instance
 */
export class OllamaProvider implements AIProviderService {
  name = "Ollama";
  type = "ollama";
  baseUrl = "http://localhost:11434/api";
  isConnected = false;
  
  private models: AIModel[] = [
    {
      id: "llama3",
      name: "Llama 3 8B",
      type: "chat",
      status: "active",
      provider: "Ollama",
      ramUsage: "4.5 GB",
      contextLength: 8192,
    }
  ];

  async connect(): Promise<boolean> {
    // Phase 3: Fetch /api/tags to check connection
    this.isConnected = true;
    return true;
  }

  async getModels(): Promise<AIModel[]> {
    // Phase 3: Fetch real models from /api/tags
    return this.models;
  }

  async chat(messages: Message[], modelId?: string): Promise<Message> {
    // Phase 3: Implement /api/chat call
    console.log(`[Ollama] Chat using ${modelId || 'default'}`, messages);
    
    return {
      id: Date.now().toString(),
      role: "assistant",
      content: "This is a stub response from the Ollama provider implementation.",
      timestamp: new Date(),
    };
  }

  async stream(
    messages: Message[], 
    modelId?: string, 
    onChunk?: (chunk: string) => void
  ): Promise<Message> {
    // Phase 3: Implement streaming /api/chat call
    console.log(`[Ollama] Stream using ${modelId || 'default'}`, messages);
    
    if (onChunk) {
      const words = "This is a simulated streaming response from the Ollama provider.".split(" ");
      for (const word of words) {
        onChunk(word + " ");
        await new Promise(r => setTimeout(r, 50));
      }
    }
    
    return {
      id: Date.now().toString(),
      role: "assistant",
      content: "This is a simulated streaming response from the Ollama provider.",
      timestamp: new Date(),
    };
  }
}

// Export a singleton instance
export const ollamaProvider = new OllamaProvider();
