const CACHE_NAME = "alarm-note-cache-v1";
const RESOURCES_TO_CACHE = [
  "/",
  "/index.html",
  "/alarm.wav",
  "/icons/pwa-192x192.png",
  "/icons/pwa-512x512.png",
];

// Install event - cache necessary files
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(RESOURCES_TO_CACHE);
    })
  );
  self.skipWaiting(); // Activate worker immediately
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - for offline capability
self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/tasks")) {
    // Network-first strategy for API requests
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  } else {
    // Cache-first strategy for static resources
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});

// Background Sync for tasks
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-tasks") {
    console.log("Syncing tasks in background");
    event.waitUntil(syncTasks());
  }
});

// Periodically check for alarms (using Periodic Background Sync API)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "check-alarms") {
    console.log("Checking alarms in background");
    event.waitUntil(checkForAlarms());
  }
});

// Message handler for alarm checks from the main thread
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CHECK_ALARMS") {
    event.waitUntil(checkForAlarms());
  } else if (event.data && event.data.type === "SCHEDULE_ALARM") {
    event.waitUntil(scheduleAlarm(event.data.task));
  } else if (event.data && event.data.type === "UPDATE_ALARM") {
    event.waitUntil(updateAlarm(event.data.task));
  } else if (event.data && event.data.type === "REMOVE_ALARM") {
    event.waitUntil(removeAlarm(event.data.taskId));
  } else if (event.data && event.data.type === "STOP_ALARM") {
    // Notify all clients to stop the alarm
    notifyClientsToStopAlarm();
  }
});

// Push notification handler
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  console.log("Push notification received:", data);

  const options = {
    body: data.body || "Your task is due!",
    icon: "/icons/pwa-192x192.png",
    badge: "/icons/pwa-192x192.png",
    vibrate: [200, 100, 200, 100, 200],
    tag: data.id || "alarm-notification",
    actions: [
      { action: "complete", title: "Mark Complete" },
      { action: "snooze", title: "Snooze" },
    ],
    data: data,
    // Keep screen on for notifications if supported
    requireInteraction: true,
    // Make notification persist until user interacts with it
    silent: false,
    renotify: true,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || "Alarm Note", options),
      notifyClientsToPlayAlarm(data.id || "alarm-notification"),
    ])
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "complete") {
    // Mark task as complete
    const taskId = event.notification.data.id;
    event.waitUntil(
      Promise.all([markTaskComplete(taskId), notifyClientsToStopAlarm()])
    );
  } else if (event.action === "snooze") {
    // Snooze the alarm (reschedule for 5 minutes later)
    const taskData = event.notification.data;
    event.waitUntil(
      Promise.all([snoozeAlarm(taskData), notifyClientsToStopAlarm()])
    );
  } else {
    // Open the app when clicking the notification
    event.waitUntil(
      Promise.all([
        self.clients.matchAll({ type: "window" }).then((clientList) => {
          // If a window is already open, focus it
          for (const client of clientList) {
            if (
              client.url.includes(self.registration.scope) &&
              "focus" in client
            ) {
              return client.focus();
            }
          }
          // If no window is open, open a new one
          if (self.clients.openWindow) {
            return self.clients.openWindow("/");
          }
        }),
        // Don't automatically stop the alarm when opening the app
        // Let the user explicitly stop it
      ])
    );
  }
});

// Function to check for due alarms
async function checkForAlarms() {
  try {
    // Try to fetch tasks from the network
    const response = await fetch("https://alarm-note-backend.vercel.app/tasks");
    const tasks = await response.json();

    // Store tasks in cache for offline use
    const cache = await caches.open(CACHE_NAME);
    await cache.put("/tasks", new Response(JSON.stringify(tasks)));

    // Check if any tasks are due
    const now = new Date();
    const currentTime = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const dueTasks = tasks.filter(
      (task) => !task.completed && task.time === currentTime
    );

    if (dueTasks.length > 0) {
      // Trigger notifications for due tasks
      await Promise.all(
        dueTasks.map(async (task) => {
          await self.registration.showNotification("Task Due!", {
            body: task.title || "Your scheduled task is due now!",
            icon: "/icons/pwa-192x192.png",
            badge: "/icons/pwa-192x192.png",
            vibrate: [200, 100, 200, 100, 200],
            tag: `task-${task.id}`,
            actions: [
              { action: "complete", title: "Mark Complete" },
              { action: "snooze", title: "Snooze" },
            ],
            data: task,
            requireInteraction: true,
            silent: false,
            renotify: true,
          });
        })
      );

      // Notify clients to play alarm sound
      await notifyClientsToPlayAlarm();
    }

    return dueTasks.length > 0;
  } catch (error) {
    console.error("Error checking alarms:", error);

    // Try to get tasks from cache if network fails
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match("/tasks");

    if (cachedResponse) {
      const tasks = await cachedResponse.json();
      const now = new Date();
      const currentTime = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const dueTasks = tasks.filter(
        (task) => !task.completed && task.time === currentTime
      );

      if (dueTasks.length > 0) {
        // Trigger notifications for due tasks
        await Promise.all(
          dueTasks.map(async (task) => {
            await self.registration.showNotification("Task Due!", {
              body: task.title || "Your scheduled task is due now!",
              icon: "/icons/pwa-192x192.png",
              badge: "/icons/pwa-192x192.png",
              vibrate: [200, 100, 200, 100, 200],
              tag: `task-${task.id}`,
              actions: [
                { action: "complete", title: "Mark Complete" },
                { action: "snooze", title: "Snooze" },
              ],
              data: task,
              requireInteraction: true,
            });
          })
        );

        // Notify clients to play alarm sound
        await notifyClientsToPlayAlarm();
      }

      return dueTasks.length > 0;
    }

    return false;
  }
}

// Function to schedule an alarm
async function scheduleAlarm(task) {
  // Store the task locally for offline access
  const alarms = await getStoredAlarms();
  alarms.push(task);
  await storeAlarms(alarms);

  // If Push API subscription exists, use it
  const subscription = await self.registration.pushManager.getSubscription();
  if (subscription) {
    // Logic to send to server for push notification scheduling
    // would go here in a real implementation
    console.log("Push subscription exists, would schedule server-side push");
  }

  return true;
}

// Function to update an alarm
async function updateAlarm(task) {
  const alarms = await getStoredAlarms();
  const index = alarms.findIndex((alarm) => alarm.id === task.id);

  if (index !== -1) {
    alarms[index] = task;
    await storeAlarms(alarms);
    console.log(`Alarm updated for task ${task.id}`);
  }

  return true;
}

// Function to remove an alarm
async function removeAlarm(taskId) {
  const alarms = await getStoredAlarms();
  const filteredAlarms = alarms.filter((alarm) => alarm.id !== taskId);

  if (filteredAlarms.length < alarms.length) {
    await storeAlarms(filteredAlarms);
    console.log(`Alarm removed for task ${taskId}`);
  }

  return true;
}

// Helper function to mark a task as complete
async function markTaskComplete(taskId) {
  try {
    const response = await fetch(
      `https://alarm-note-backend.vercel.app/tasks/${taskId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ completed: true }),
      }
    );

    if (response.ok) {
      console.log(`Task ${taskId} marked as complete`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to mark task complete:", error);
    // Queue for background sync later
    const pendingActions = await getPendingActions();
    pendingActions.push({
      type: "COMPLETE_TASK",
      taskId,
      timestamp: new Date().getTime(),
    });
    await storePendingActions(pendingActions);
    await self.registration.sync.register("sync-tasks");
    return false;
  }
}

// Helper function to snooze an alarm
async function snoozeAlarm(taskData) {
  // Reschedule notification for 5 minutes later
  const snoozeTime = 5 * 60 * 1000; // 5 minutes in milliseconds

  setTimeout(() => {
    self.registration.showNotification("Snoozed Task", {
      body: taskData.title || "Your snoozed task is due now!",
      icon: "/icons/pwa-192x192.png",
      badge: "/icons/pwa-192x192.png",
      vibrate: [200, 100, 200],
      tag: `task-${taskData.id}-snoozed`,
      data: taskData,
      requireInteraction: true,
    });

    // Notify clients to play alarm sound when snooze time is up
    notifyClientsToPlayAlarm();
  }, snoozeTime);

  return true;
}

// Helper function to sync tasks with the server
async function syncTasks() {
  const pendingActions = await getPendingActions();

  for (const action of pendingActions) {
    try {
      if (action.type === "COMPLETE_TASK") {
        await markTaskComplete(action.taskId);
      }
      // Add other action types as needed
    } catch (error) {
      console.error(`Failed to sync action ${action.type}:`, error);
      // Leave in queue for next sync attempt
      continue;
    }

    // Remove successfully processed action
    const updatedActions = await getPendingActions();
    const index = updatedActions.findIndex(
      (a) => a.type === action.type && a.taskId === action.taskId
    );

    if (index !== -1) {
      updatedActions.splice(index, 1);
      await storePendingActions(updatedActions);
    }
  }
}

// New function to notify all clients to play alarm sound
async function notifyClientsToPlayAlarm(alarmId = "default-alarm") {
  try {
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    if (clients.length > 0) {
      // Send message to all clients to play alarm
      clients.forEach((client) => {
        client.postMessage({
          type: "PLAY_ALARM",
          alarmId: alarmId,
        });
      });
      console.log("Notified clients to play alarm");
    } else {
      console.log("No clients found to play alarm");
      // Attempt to wake up application if possible
      try {
        if ("windowClient" in self.clients) {
          const windowClients = await self.clients.matchAll({ type: "window" });
          for (const windowClient of windowClients) {
            if (
              windowClient.navigate &&
              windowClient.visibilityState === "hidden"
            ) {
              await windowClient.navigate(windowClient.url);
              break;
            }
          }
        }
      } catch (error) {
        console.log("Unable to wake up application:", error);
      }
    }
    return true;
  } catch (error) {
    console.error("Error notifying clients to play alarm:", error);
    return false;
  }
}

// New function to notify all clients to stop alarm sound
async function notifyClientsToStopAlarm() {
  try {
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    clients.forEach((client) => {
      client.postMessage({
        type: "STOP_ALARM",
      });
    });
    console.log("Notified clients to stop alarm");
    return true;
  } catch (error) {
    console.error("Error notifying clients to stop alarm:", error);
    return false;
  }
}

// IndexedDB helpers for offline data storage
async function getStoredAlarms() {
  return getFromDB("alarms") || [];
}

async function storeAlarms(alarms) {
  return storeToDB("alarms", alarms);
}

async function getPendingActions() {
  return getFromDB("pendingActions") || [];
}

async function storePendingActions(actions) {
  return storeToDB("pendingActions", actions);
}

async function getFromDB(key) {
  return new Promise((resolve) => {
    const request = indexedDB.open("AlarmNoteDB", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("keyValueStore")) {
        db.createObjectStore("keyValueStore");
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(["keyValueStore"], "readonly");
      const store = transaction.objectStore("keyValueStore");
      const getRequest = store.get(key);

      getRequest.onsuccess = () => {
        resolve(getRequest.result);
      };

      getRequest.onerror = () => {
        console.error(`Error reading ${key} from IndexedDB`);
        resolve(null);
      };
    };

    request.onerror = () => {
      console.error("Error opening IndexedDB");
      resolve(null);
    };
  });
}

async function storeToDB(key, value) {
  return new Promise((resolve) => {
    const request = indexedDB.open("AlarmNoteDB", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("keyValueStore")) {
        db.createObjectStore("keyValueStore");
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(["keyValueStore"], "readwrite");
      const store = transaction.objectStore("keyValueStore");
      const putRequest = store.put(value, key);

      putRequest.onsuccess = () => {
        resolve(true);
      };

      putRequest.onerror = () => {
        console.error(`Error storing ${key} to IndexedDB`);
        resolve(false);
      };
    };

    request.onerror = () => {
      console.error("Error opening IndexedDB");
      resolve(false);
    };
  });
}
