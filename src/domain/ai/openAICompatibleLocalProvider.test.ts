import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeLocalEndpoint, OpenAICompatibleLocalProvider } from './openAICompatibleLocalProvider';

describe('local model endpoint boundary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('allows only loopback endpoints and normalizes a base URL', () => {
    expect(normalizeLocalEndpoint('http://127.0.0.1:1234')).toBe('http://127.0.0.1:1234/v1/chat/completions');
    expect(normalizeLocalEndpoint('http://localhost:1234/v1/chat/completions')).toBe('http://localhost:1234/v1/chat/completions');
    expect(() => normalizeLocalEndpoint('https://example.com/v1/chat/completions')).toThrow(/loopback/i);
    expect(() => normalizeLocalEndpoint('http://localhost:1234/v1/chat/completions?api_key=secret')).toThrow(/query-string/i);
    expect(() => normalizeLocalEndpoint('http://user:pass@localhost:1234/v1/chat/completions')).toThrow(/loopback/i);
  });

  it('rejects malformed model JSON before returning provider output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] }), { status: 200 })));
    const provider = new OpenAICompatibleLocalProvider({ endpoint: 'http://127.0.0.1:1234/v1/chat/completions', model: 'test' });
    await expect(provider.generatePractice({ conceptTitle: 'arrays' })).rejects.toThrow(/valid JSON/i);
  });

  it('bounds practice output from a local model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ prompts: ['Recall the rule', 'Solve a short exercise', 'Apply it to a tiny example', 'Extra 4', 'Extra 5', 'Extra 6', 'Extra 7'] }) } }] }), { status: 200 })));
    const provider = new OpenAICompatibleLocalProvider({ endpoint: 'http://127.0.0.1:1234/v1/chat/completions', model: 'test' });
    const prompts = await provider.generatePractice({ conceptTitle: 'arrays' });
    expect(prompts).toHaveLength(6);
  });
});
