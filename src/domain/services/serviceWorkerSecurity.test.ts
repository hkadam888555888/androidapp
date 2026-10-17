import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const workerSource = await readFile(new URL('../../../public/sw.js', import.meta.url), 'utf8');

type RequestLike = { url: string; method: string; mode: string };
type WorkerEvent = {
  request: RequestLike;
  responsePromise?: Promise<unknown>;
  respondWith: (response: Promise<unknown>) => void;
};

function makeHarness(contentType = 'text/javascript') {
  const listeners = new Map<string, (...args: never[]) => unknown>();
  const cache = {
    addAll: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
  };
  const cacheStorage = {
    match: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
  };
  const self = {
    location: { origin: 'https://routine.test' },
    addEventListener: (type: string, listener: unknown) => {
      listeners.set(type, listener as (...args: never[]) => unknown);
    },
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
  };
  const response = {
    ok: true,
    type: 'basic',
    headers: { get: vi.fn((name: string) => name.toLowerCase() === 'content-type' ? contentType : null) },
    clone: vi.fn(() => ({ cached: true })),
  };
  const fetchMock = vi.fn().mockResolvedValue(response);

  vm.runInNewContext(workerSource, {
    self,
    caches: cacheStorage,
    fetch: fetchMock,
    URL,
    Promise,
    Response: globalThis.Response,
    setTimeout,
    clearTimeout,
    console,
  });

  const fetchHandler = listeners.get('fetch');
  if (!fetchHandler) throw new Error('Service worker did not register its fetch handler.');

  function dispatch(url: string, options: { method?: string; mode?: string } = {}): WorkerEvent {
    const event: WorkerEvent = {
      request: { url, method: options.method ?? 'GET', mode: options.mode ?? 'cors' },
      respondWith(responsePromise) { event.responsePromise = responsePromise; },
    };
    fetchHandler(event as never);
    return event;
  }

  return { dispatch, cache, cacheStorage, fetchMock };
}

describe('service-worker cache security boundary', () => {
  it('does not intercept or cache same-origin API and export responses', () => {
    const harness = makeHarness();

    const api = harness.dispatch('https://routine.test/api/backup');
    const exportRoute = harness.dispatch('https://routine.test/exports/private-backup.json');

    expect(api.responsePromise).toBeUndefined();
    expect(exportRoute.responsePromise).toBeUndefined();
    expect(harness.cacheStorage.match).not.toHaveBeenCalled();
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it('does not cache an API response even if the URL is navigated to', async () => {
    const harness = makeHarness('application/json');

    const apiNavigation = harness.dispatch('https://routine.test/api/private-data', { mode: 'navigate' });
    expect(apiNavigation.responsePromise).toBeDefined();

    await apiNavigation.responsePromise;

    expect(harness.cacheStorage.open).not.toHaveBeenCalled();
    expect(harness.cache.put).not.toHaveBeenCalled();
  });

  it('caches a root navigation only when the response is HTML', async () => {
    const htmlHarness = makeHarness('text/html; charset=utf-8');
    const rootNavigation = htmlHarness.dispatch('https://routine.test/', { mode: 'navigate' });
    expect(rootNavigation.responsePromise).toBeDefined();

    await rootNavigation.responsePromise;

    expect(htmlHarness.cacheStorage.open).toHaveBeenCalledWith('my-adaptive-routine-shell-v1.0.5');
    expect(htmlHarness.cache.put).toHaveBeenCalledTimes(1);
  });

  it('runtime-caches an allow-listed production asset', async () => {
    const harness = makeHarness();

    const asset = harness.dispatch('https://routine.test/assets/app-abc123.js');
    expect(asset.responsePromise).toBeDefined();

    await asset.responsePromise;

    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.cacheStorage.open).toHaveBeenCalledWith('my-adaptive-routine-shell-v1.0.5');
    expect(harness.cache.put).toHaveBeenCalledTimes(1);
  });

  it('does not intercept cross-origin requests or non-GET mutations', () => {
    const harness = makeHarness();

    const external = harness.dispatch('https://other.test/assets/app.js');
    const mutation = harness.dispatch('https://routine.test/assets/app.js', { method: 'POST' });

    expect(external.responsePromise).toBeUndefined();
    expect(mutation.responsePromise).toBeUndefined();
    expect(harness.cacheStorage.match).not.toHaveBeenCalled();
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });
});
