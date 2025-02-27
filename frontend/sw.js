// const CACHE_NAME = "alarm-cache-v1";

// self.addEventListener("install", (event) => {
//   event.waitUntil(
//     caches
//       .open(CACHE_NAME)
//       .then((cache) => cache.addAll(["/alarm.wav", "/tasks"]))
//   );
// });

// self.addEventListener("fetch", (event) => {
//   if (event.request.url.includes("/tasks")) {
//     event.respondWith(
//       caches.open(CACHE_NAME).then(async (cache) => {
//         const response = await fetch(event.request);
//         cache.put(event.request, response.clone());
//         return response;
//       })
//     );
//   }
// });

// // Add message listener for fallback checks
// self.addEventListener("message", (event) => {
//   if (event.data.type === "checkAlarms") {
//     event.waitUntil(handleAlarmCheck());
//   }
// });

// async function handleAlarmCheck() {
//   const cache = await caches.open(CACHE_NAME);
//   const response = await cache.match("/tasks");
//   const todos = response ? await response.json() : [];

//   const now = new Date().toLocaleTimeString("en-US", {
//     hour: "2-digit",
//     minute: "2-digit",
//     hour12: false,
//   });

//   const shouldRing = todos.some((todo) => !todo.completed && todo.time === now);

//   if (shouldRing) {
//     // Only play audio if no existing alarms are ringing
//     const clients = await self.clients.matchAll();
//     if (!clients.some((client) => client.url.includes("alarm-notes"))) {
//       // Play audio through Web Audio API
//       const alarmCache = await caches.open(CACHE_NAME);
//       const audioResponse = await alarmCache.match("/alarm.wav");
//       const audioBuffer = await audioResponse.arrayBuffer();

//       const audioCtx = new AudioContext();
//       const source = audioCtx.createBufferSource();
//       source.buffer = await audioCtx.decodeAudioData(audioBuffer);
//       source.connect(audioCtx.destination);
//       source.start(0);
//     }

//     // Show notification
//     self.registration.showNotification("Alarm Triggered!", {
//       body: "Your task is due!",
//       icon: "/icons/pwa-192x192.png",
//       vibrate: [200, 100, 200],
//     });
//   }
// }

self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  self.skipWaiting(); // Activate worker immediately
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  return self.clients.claim();
});

// Background Sync API
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-data") {
    console.log("Sync event triggered");
    event.waitUntil(syncData()); // Perform background sync
  }
});

// Example function for syncing data in background
async function syncData() {
  console.log("Performing background sync...");

  try {
    const response = await fetch("/sync-endpoint", {
      method: "POST",
      body: JSON.stringify({ message: "Background sync" }),
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error("Sync failed");
    console.log("Background sync completed successfully");
  } catch (error) {
    console.error("Background sync failed:", error);
  }
}

// Push Notification Example
self.addEventListener("push", (event) => {
  console.log("Push notification received:", event);
  event.waitUntil(
    self.registration.showNotification("Hello!", {
      body: "This is a background notification.",
      icon: "/icon.png",
    })
  );
});
