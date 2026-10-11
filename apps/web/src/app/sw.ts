/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

/**
 * Offline behaviour (claims C13, C14). The app shell and the rule bundle are cached so a
 * citizen on a dead 2G cell can still answer questions and see an eligibility result marked
 * "provisional". Anything that changes state is never served from a cache: it goes to the
 * network, and the app queues it in IndexedDB when that fails.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // The offline rule bundle: serve instantly, refresh in the background.
      matcher: ({ url }) => url.pathname === '/api/v1/rules/bundle',
      handler: new StaleWhileRevalidate({ cacheName: 'rules-bundle' }),
    },
    {
      // Map tiles are big and optional: keep a few, never block on them.
      matcher: ({ url }) => url.hostname.endsWith('tile.openstreetmap.org'),
      handler: new StaleWhileRevalidate({ cacheName: 'map-tiles' }),
    },
    {
      // Page navigations and the React payloads behind them. The citizen journey is warmed
      // while there is a connection (see warmOfflineRoutes), so the next step still opens on
      // a dead cell instead of falling back to the offline page.
      matcher: ({ request, url }) =>
        request.mode === 'navigate' ||
        url.searchParams.has('_rsc') ||
        request.headers.get('RSC') === '1' ||
        // The warm-up fetches documents with plain fetch(), whose mode is not 'navigate';
        // without this they would never land in the page cache and only the React payload
        // would be stored, leaving an offline reload of that route with nothing to serve.
        (request.method === 'GET' && !url.pathname.startsWith('/api/') && (request.headers.get('accept') ?? '').includes('text/html')),
      handler: new NetworkFirst({
        cacheName: 'pages',
        networkTimeoutSeconds: 4,
        // Next sends `Vary: RSC, Next-Router-State-Tree, ...`, so a page warmed with fetch()
        // never matched the real navigation and offline reloads died with ERR_FAILED. The
        // cache key below already keeps HTML and React payloads apart, so Vary adds nothing.
        matchOptions: { ignoreVary: true },
        plugins: [
          {
            // Next puts a build-specific token in `_rsc`, so the warmed copy and the real
            // request would never share a cache entry. Normalise it to a constant — but keep
            // the parameter, because the React payload and the HTML document for the same
            // path are different responses and must not overwrite each other.
            cacheKeyWillBeUsed: async ({ request }: { request: Request }) => {
              const url = new URL(request.url);
              if (url.searchParams.has('_rsc') || request.headers.get('RSC') === '1') url.searchParams.set('_rsc', '1');
              return url.toString();
            },
          },
        ],
      }),
    },
    {
      // Reads may come from cache while offline; writes must not.
      matcher: ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
      handler: new NetworkFirst({ cacheName: 'api-reads', networkTimeoutSeconds: 6 }),
    },
    { matcher: ({ url }) => url.pathname.startsWith('/api/'), handler: new NetworkOnly() },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: '/offline', matcher: ({ request }) => request.destination === 'document' }],
  },
});

serwist.addEventListeners();
