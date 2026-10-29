// Firebase Analytics: visits are counted automatically (page_view / session_start),
// opened candies are sent as a custom `candy_opened` event.
// Firebase web config values are public identifiers, not secrets — safe to commit.

const SDK = 'https://www.gstatic.com/firebasejs/11.0.2';

const firebaseConfig = {
  apiKey: 'AIzaSyBMSfnte5mwwLRsveBf9GwEyYoQjyju09k',
  authDomain: 'misophonia-c4160.firebaseapp.com',
  projectId: 'misophonia-c4160',
  storageBucket: 'misophonia-c4160.firebasestorage.app',
  messagingSenderId: '517969157144',
  appId: '1:517969157144:web:7d76135b069cd57a83f76d',
  measurementId: 'G-995TT350X6',
};

// Keep local development out of the stats; add ?analytics to the URL to test locally.
const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);
const enabled = !isLocal || new URLSearchParams(location.search).has('analytics');

let send = null;

// Loaded separately so an ad blocker or offline CDN never breaks the app.
const ready = enabled
  ? (async () => {
    try {
      const [{ initializeApp }, { getAnalytics, isSupported, logEvent }] = await Promise.all([
        import(`${SDK}/firebase-app.js`),
        import(`${SDK}/firebase-analytics.js`),
      ]);
      if (!(await isSupported())) return;
      const analytics = getAnalytics(initializeApp(firebaseConfig));
      send = (name, params) => logEvent(analytics, name, params);
    } catch (err) {
      console.warn('Analytics unavailable:', err);
    }
  })()
  : Promise.resolve();

export function track(name, params) {
  ready.then(() => send?.(name, params));
}
