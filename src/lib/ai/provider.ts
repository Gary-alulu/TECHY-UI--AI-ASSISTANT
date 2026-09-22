import { AIModel, Message } from "@/types";

/**
 * Base AI Provider Interface
 * All AI integrations (Ollama, LM Studio, etc.) must implement this interface.
 */
export interface AIProviderService {
  name: string;
  type: string;
  baseUrl: string;
  isConnected: boolean;
  
  /**
   * Initialize connection and fetch available models
   */
  connect(): Promise<boolean>;
  
  /**
   * Get list of available models from this provider
   */
  getModels(): Promise<AIModel[]>;
  
  /**
   * Standard chat request without streaming
   */
  chat(messages: Message[], modelId?: string): Promise<Message>;
  
  /**
   * Streaming chat request
   * @param onChunk Callback for each stream token
   */
  stream(
    messages: Message[], 
    modelId?: string, 
    onChunk?: (chunk: string) => void
  ): Promise<Message>;
}
