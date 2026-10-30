import { describe, expect, it } from 'vitest';
import { getAIProvider } from './aiProviderFactory';

describe('AI provider selection', () => {
  it('uses the explicit deterministic provider by default', () => {
    expect(getAIProvider().name).toBe('RuleBasedProvider');
  });

  it('does not silently downgrade a selected local model to rule-based output', () => {
    expect(() => getAIProvider({
      id: 'ai-settings', localOnly: true, cloudEnabled: false, explanationMode: 'short',
      retainHistory: true, providerName: 'OpenAICompatibleLocalProvider',
    })).toThrow(/endpoint is missing/i);
  });

  it('rejects non-loopback model endpoints instead of pretending the model is connected', () => {
    expect(() => getAIProvider({
      id: 'ai-settings', localOnly: true, cloudEnabled: false, explanationMode: 'short',
      retainHistory: true, providerName: 'OpenAICompatibleLocalProvider',
      localEndpoint: 'https://example.com/v1/chat/completions', localModel: 'test-model',
    })).toThrow(/loopback|localhost|local/i);
  });
});
