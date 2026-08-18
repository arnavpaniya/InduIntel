export * from './provider';
export * from './mock-provider';

import { AIProvider } from './provider';
import { OllamaProvider, createOllamaProviderFromEnv } from './provider';
import { MockProvider, createMockProvider } from './mock-provider';

let aiProviderInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (aiProviderInstance) {
    return aiProviderInstance;
  }

  const useMock = process.env.USE_MOCK_AI === 'true';

  if (useMock) {
    aiProviderInstance = createMockProvider();
    return aiProviderInstance;
  }

  // Real production path: Ollama must be configured
  try {
    aiProviderInstance = createOllamaProviderFromEnv();
    return aiProviderInstance;
  } catch (error: any) {
    throw new Error(
      `AI Provider Initialization Failed: ${error.message || error}. Please ensure OLLAMA_HOST and OLLAMA_MODEL are configured in .env.local, or set USE_MOCK_AI=true for testing.`
    );
  }
}

export function setAIProvider(provider: AIProvider) {
  aiProviderInstance = provider;
}

export { OllamaProvider, MockProvider };