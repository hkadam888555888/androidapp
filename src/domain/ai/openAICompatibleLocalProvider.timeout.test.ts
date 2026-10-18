import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleLocalProvider } from './openAICompatibleLocalProvider';

describe('local model timeout and response boundary', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('aborts an unresponsive loopback provider at the configured minimum timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAICompatibleLocalProvider({
      endpoint: 'http://127.0.0.1:1234/v1/chat/completions',
      model: 'timeout-test',
      timeoutMs: 1,
    });
    const pending = provider.generatePractice({ conceptTitle: 'arrays' });
    const rejected = expect(pending).rejects.toThrow(/timed out after 2 seconds/i);
    await vi.advanceTimersByTimeAsync(2_000);
    await rejected;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a successful HTTP response whose choices envelope is malformed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: { message: { content: '{}' } } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAICompatibleLocalProvider({
      endpoint: 'http://127.0.0.1:1234/v1/chat/completions',
      model: 'schema-test',
    });
    await expect(provider.generatePractice({ conceptTitle: 'arrays' })).rejects.toThrow(/no usable JSON text|valid JSON/i);
  });

  it('rejects oversized model response text rather than parsing it', async () => {
    const content = 'x'.repeat(100_001);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAICompatibleLocalProvider({
      endpoint: 'http://127.0.0.1:1234/v1/chat/completions',
      model: 'bounded-response-test',
    });
    await expect(provider.generatePractice({ conceptTitle: 'arrays' })).rejects.toThrow(/exceeded the response limit/i);
  });
});
