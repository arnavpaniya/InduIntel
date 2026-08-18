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

  const useMock = process.env.USE_MOCK_AI === 'true' || process.env.NODE_ENV === 'test';

  if (useMock) {
    aiProviderInstance = createMockProvider();
    return aiProviderInstance;
  }

  try {
    aiProviderInstance = createOllamaProviderFromEnv();
    return aiProviderInstance;
  } catch (error) {
    console.warn('Failed to initialize Ollama provider, falling back to mock:', error);
    aiProviderInstance = createMockProvider();
    return aiProviderInstance;
  }
}

export function setAIProvider(provider: AIProvider) {
  aiProviderInstance = provider;
}

export { OllamaProvider, MockProvider };