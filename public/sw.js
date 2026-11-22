/**
 * RP Skill | Ranjan Pathshala — Minimal PWA Service Worker
 * Keeps installation & lifecycle clean without intercepting API mutations.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
