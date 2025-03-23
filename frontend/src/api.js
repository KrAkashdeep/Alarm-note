import axios from "axios";
const api_url = "https://alarm-note-backend.vercel.app";

// API functions for task management
export const addTask = async (post) => {
  try {
    const response = await axios.post(`${api_url}/tasks`, post);
    // Schedule alarm in service worker
    await scheduleAlarmInServiceWorker(response.data);
    return response.data;
  } catch (error) {
    // Save task locally if API call fails
    const localTask = { ...post, id: `local-${Date.now()}`, offline: true };
    await saveTaskLocally(localTask);
    await scheduleAlarmInServiceWorker(localTask);

    return {
      message: "Task saved locally due to connection issue",
      data: localTask,
      error: error.message,
    };
  }
};

export const getTasks = async () => {
  try {
    const response = await axios.get(`${api_url}/tasks`);

    // Merge with any offline tasks
    const offlineTasks = await getOfflineTasks();
    const allTasks = [...response.data, ...offlineTasks];

    return allTasks;
  } catch (error) {
    // Return offline tasks if API call fails
    const offlineTasks = await getOfflineTasks();

    return offlineTasks.length > 0
      ? offlineTasks
      : {
          message: "Error fetching tasks, using offline data",
          error: error.message,
        };
  }
};

export const updateTask = async (id, post) => {
  // Check if it's a local task first
  if (id.startsWith("local-")) {
    const updatedTask = { ...post, id, offline: true };
    await updateLocalTask(updatedTask);

    // Update alarm in service worker if needed
    if (post.time || post.completed !== undefined) {
      await updateAlarmInServiceWorker(updatedTask);
    }

    return updatedTask;
  }

  try {
    const response = await axios.put(`${api_url}/tasks/${id}`, post);

    // Update alarm in service worker if needed
    if (post.time || post.completed !== undefined) {
      await updateAlarmInServiceWorker(response.data);
    }

    return response.data;
  } catch (error) {
    // Save update locally for syncing later
    const updatedTask = { ...post, id, pendingUpdate: true };
    await saveTaskUpdateLocally(id, updatedTask);

    // Update alarm even if offline
    if (post.time || post.completed !== undefined) {
      await updateAlarmInServiceWorker(updatedTask);
    }

    return {
      message: "Update saved locally due to connection issue",
      data: updatedTask,
      error: error.message,
    };
  }
};

export const deleteTask = async (id) => {
  // Check if it's a local task first
  if (id.startsWith("local-")) {
    await removeLocalTask(id);
    await removeAlarmFromServiceWorker(id);
    return { message: "Local task deleted successfully", id };
  }

  try {
    const response = await axios.delete(`${api_url}/tasks/${id}`);
    // Remove alarm from service worker
    await removeAlarmFromServiceWorker(id);
    return response.data;
  } catch (error) {
    // Mark for deletion when back online
    await markTaskForDeletion(id);
    // Still remove the alarm even when offline
    await removeAlarmFromServiceWorker(id);

    return {
      message: "Task marked for deletion when online",
      id,
      error: error.message,
    };
  }
};

// Sync offline data when back online
export const syncOfflineData = async () => {
  try {
    // Sync new tasks
    const offlineTasks = await getOfflineTasks();
    const syncPromises = [];

    for (const task of offlineTasks) {
      if (task.offline) {
        // Remove the offline flag before sending
        const { offline, ...cleanTask } = task;

        // If it has a local ID, create a new task
        if (task.id.startsWith("local-")) {
          syncPromises.push(
            axios
              .post(`${api_url}/tasks`, cleanTask)
              .then((response) => {
                // Update the alarm with the new server ID
                updateAlarmInServiceWorker(response.data);
                return removeLocalTask(task.id);
              })
              .catch((error) =>
                console.error(`Failed to sync task ${task.id}:`, error)
              )
          );
        }
      }
    }

    // Sync pending updates
    const pendingUpdates = JSON.parse(
      localStorage.getItem("pendingUpdates") || "{}"
    );
    for (const [id, task] of Object.entries(pendingUpdates)) {
      const { pendingUpdate, ...cleanTask } = task;

      syncPromises.push(
        axios
          .put(`${api_url}/tasks/${id}`, cleanTask)
          .then(() => {
            // Remove from pending updates
            const updates = JSON.parse(
              localStorage.getItem("pendingUpdates") || "{}"
            );
            delete updates[id];
            localStorage.setItem("pendingUpdates", JSON.stringify(updates));
          })
          .catch((error) =>
            console.error(`Failed to sync update for task ${id}:`, error)
          )
      );
    }

    // Sync pending deletions
    const pendingDeletions = JSON.parse(
      localStorage.getItem("pendingDeletions") || "[]"
    );
    for (const id of pendingDeletions) {
      syncPromises.push(
        axios
          .delete(`${api_url}/tasks/${id}`)
          .then(() => {
            // Remove from pending deletions
            const deletions = JSON.parse(
              localStorage.getItem("pendingDeletions") || "[]"
            );
            const updatedDeletions = deletions.filter(
              (taskId) => taskId !== id
            );
            localStorage.setItem(
              "pendingDeletions",
              JSON.stringify(updatedDeletions)
            );
          })
          .catch((error) =>
            console.error(`Failed to sync deletion for task ${id}:`, error)
          )
      );
    }

    await Promise.allSettled(syncPromises);
    return { success: true, message: "Offline data synchronized" };
  } catch (error) {
    console.error("Sync failed:", error);
    return { success: false, error: error.message };
  }
};

// Push notification subscription
export const subscribeToPushNotifications = async () => {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { success: false, message: "Push notifications not supported" };
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        // Your VAPID public key would go here
        "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"
      ),
    });

    // Send the subscription to your server
    const response = await axios.post(
      `${api_url}/push-subscription`,
      subscription
    );
    return { success: true, subscription };
  } catch (error) {
    console.error("Push subscription error:", error);
    return { success: false, error: error.message };
  }
};

// Helper functions for offline support
async function saveTaskLocally(task) {
  const tasks = await getOfflineTasks();
  tasks.push(task);
  localStorage.setItem("offlineTasks", JSON.stringify(tasks));

  // Register for background sync if available
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register("sync-tasks");
  }
}

async function getOfflineTasks() {
  const tasksJson = localStorage.getItem("offlineTasks");
  return tasksJson ? JSON.parse(tasksJson) : [];
}

async function updateLocalTask(updatedTask) {
  const tasks = await getOfflineTasks();
  const index = tasks.findIndex((t) => t.id === updatedTask.id);

  if (index !== -1) {
    tasks[index] = updatedTask;
    localStorage.setItem("offlineTasks", JSON.stringify(tasks));
  }

  return updatedTask;
}

async function removeLocalTask(id) {
  const tasks = await getOfflineTasks();
  const filteredTasks = tasks.filter((t) => t.id !== id);
  localStorage.setItem("offlineTasks", JSON.stringify(filteredTasks));
}

async function saveTaskUpdateLocally(id, updatedTask) {
  const updates = JSON.parse(localStorage.getItem("pendingUpdates") || "{}");
  updates[id] = updatedTask;
  localStorage.setItem("pendingUpdates", JSON.stringify(updates));

  // Register for background sync if available
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register("sync-tasks");
  }
}

async function markTaskForDeletion(id) {
  const deletions = JSON.parse(
    localStorage.getItem("pendingDeletions") || "[]"
  );
  deletions.push(id);
  localStorage.setItem("pendingDeletions", JSON.stringify(deletions));

  // Register for background sync if available
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register("sync-tasks");
  }
}

// Alarm scheduling in Service Worker
async function scheduleAlarmInServiceWorker(task) {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.active.postMessage({
      type: "SCHEDULE_ALARM",
      task: task,
    });
  }
}

async function updateAlarmInServiceWorker(task) {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.active.postMessage({
      type: "UPDATE_ALARM",
      task: task,
    });
  }
}

async function removeAlarmFromServiceWorker(taskId) {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.active.postMessage({
      type: "REMOVE_ALARM",
      taskId: taskId,
    });
  }
}

// Utility function for push notifications
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Add service worker sync handler
export const setupServiceWorkerSync = async () => {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register(
        "/service-worker.js"
      );

      // Add sync event handler in the service worker file
      // This is just informational - the actual implementation would be in service-worker.js
      console.log("Service worker registered for background sync");

      // Try to sync immediately if we're online
      if (navigator.onLine) {
        await syncOfflineData();
      }

      return { success: true };
    } catch (error) {
      console.error("Service worker registration failed:", error);
      return { success: false, error: error.message };
    }
  }

  return { success: false, message: "Service workers not supported" };
};

// Listen for online events to trigger sync
if (typeof window !== "undefined") {
  window.addEventListener("online", async () => {
    console.log("App is back online. Syncing data...");
    await syncOfflineData();
  });
}
