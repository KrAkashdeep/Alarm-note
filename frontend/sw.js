const CACHE_NAME = "alarm-cache-v1";
// const ALARM_SYNC = "alarm-sync";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(["/alarm.wav", "/tasks"]))
  );
}); // Added missing closing

self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/tasks")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const response = await fetch(event.request);
        cache.put(event.request, response.clone());
        return response;
      })
    );
  }
});

// Add message listener for fallback checks
self.addEventListener("message", (event) => {
  if (event.data.type === "checkAlarms") {
    event.waitUntil(handleAlarmCheck());
  }
});

async function handleAlarmCheck() {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match("/tasks");
  const todos = response ? await response.json() : [];

  const now = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const shouldRing = todos.some((todo) => !todo.completed && todo.time === now);

  if (shouldRing) {
    // Only play audio if no existing alarms are ringing
    const clients = await self.clients.matchAll();
    if (!clients.some((client) => client.url.includes("alarm-notes"))) {
      // Play audio through Web Audio API
      const alarmCache = await caches.open(CACHE_NAME);
      const audioResponse = await alarmCache.match("/alarm.wav");
      const audioBuffer = await audioResponse.arrayBuffer();

      const audioCtx = new AudioContext();
      const source = audioCtx.createBufferSource();
      source.buffer = await audioCtx.decodeAudioData(audioBuffer);
      source.connect(audioCtx.destination);
      source.start(0);
    }

    // Show notification
    self.registration.showNotification("Alarm Triggered!", {
      body: "Your task is due!",
      icon: "/icons/pwa-192x192.png",
      vibrate: [200, 100, 200],
    });
  }
}
