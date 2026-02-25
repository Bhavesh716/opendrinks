/* eslint-disable no-console */

import { register } from 'register-service-worker';

const shouldDisableServiceWorker = process.env.VUE_APP_DISABLE_SW === 'true';

if (shouldDisableServiceWorker) {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then(registrations => Promise.all(registrations.map(r => r.unregister())))
      .then(() => {
        if ('caches' in window) {
          return caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
        }
        return undefined;
      })
      .then(() => {
        console.log('Service worker disabled: unregistered and cleared caches.');
      })
      .catch(error => {
        console.error('Error while disabling service worker:', error);
      });
  }
} else if (process.env.NODE_ENV === 'production') {
  register(`${process.env.BASE_URL}service-worker.js`, {
    ready() {
      console.log(
        'App is being served from cache by a service worker.\n' +
          'For more details, visit https://goo.gl/AFskqB',
      );
    },
    registered() {
      console.log('Service worker has been registered.');
    },
    cached() {
      console.log('Content has been cached for offline use.');
    },
    updatefound() {
      console.log('New content is downloading.');
    },
    updated() {
      console.log('New content is available; please refresh.');
    },
    offline() {
      console.log('No internet connection found. App is running in offline mode.');
    },
    error(error) {
      console.error('Error during service worker registration:', error);
    },
  });
}
