const CACHE_NAME = 'alarm-cache-v1';
const ALARM_SYNC = 'alarm-sync';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(['/alarm.wav']))
  );
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === ALARM_SYNC) {
    event.waitUntil(handleAlarmCheck());
  }
});

async function handleAlarmCheck() {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match('/tasks');
  const todos = response ? await response.json() : [];
  
  const now = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });

  const shouldRing = todos.some(todo => 
    !todo.completed && todo.time === now
  );

  if (shouldRing) {
    self.registration.showNotification('Alarm Triggered!', {
      body: 'Your task is due!',
      icon: '/icons/pwa-192x192.png',
      vibrate: [200, 100, 200]
    });
  }
}