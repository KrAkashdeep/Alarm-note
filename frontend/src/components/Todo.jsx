import { useState, useEffect } from "react";
import alarmSound from "/alarm.wav";
import { addTask, getTasks, updateTask, deleteTask } from "../api";

const Todo = () => {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState("");
  const [time, setTime] = useState("");
  const [edit, setEdit] = useState({ id: null, text: "", time: "" });
  const [audio] = useState(() => {
    const audio = new Audio(alarmSound);
    audio.loop = true;
    return audio;
  });
  const [isRinging, setIsRinging] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const { data } = await getTasks();
        setTodos(data || []);
      } catch (error) {
        console.error("Failed to fetch tasks:", error);
        setTodos([]);
      }
    };
    fetchTasks();
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PeriodicSyncManager" in window) {
      navigator.serviceWorker.ready.then(async (registration) => {
        try {
          await registration.periodicSync.register("alarm-sync", {
            minInterval: 60 * 1000, // Check every minute
          });
        } catch (error) {
          console.log("Periodic sync could not be registered:", error);
        }
      });
    }

    // Fallback for browsers without periodic sync
    const timer = setInterval(() => {
      navigator.serviceWorker.controller.postMessage({ type: "checkAlarms" });
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const addTodo = async (e) => {
    e.preventDefault();
    if (!input.trim() || !time) return alert("Please fill both fields");

    try {
      const { data } = await addTask({
        text: input,
        time,
        completed: false,
      });
      setTodos([...todos, data]);
      setInput("");
      setTime("");
    } catch (error) {
      console.error("Failed to add task:", error);
    }
  };

  const deleteTodo = async (id) => {
    try {
      await deleteTask(id);
      setTodos(todos.filter((todo) => todo._id !== id));
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const toggleComplete = async (id) => {
    try {
      const todoToUpdate = todos.find((todo) => todo._id === id);
      const { data } = await updateTask(id, {
        ...todoToUpdate,
        completed: !todoToUpdate.completed,
      });
      setTodos(todos.map((todo) => (todo._id === id ? data : todo)));
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await updateTask(edit.id, edit);
      setTodos(todos.map((todo) => (todo._id === edit.id ? data : todo)));
      setEdit({ id: null, text: "", time: "" });
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const startEdit = (todo) => {
    setEdit({ id: todo._id, text: todo.text, time: todo.time });
  };

  const stopAlarm = () => {
    audio.pause();
    audio.currentTime = 0;
    setIsRinging(false);
  };
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Todo Alarm</h1>

        <form
          onSubmit={edit.id ? saveEdit : addTodo}
          className="mb-8 space-y-4"
        >
          <input
            type="text"
            value={edit.id ? edit.text : input}
            onChange={(e) =>
              edit.id
                ? setEdit({ ...edit, text: e.target.value })
                : setInput(e.target.value)
            }
            placeholder="Add a new task"
            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="time"
            value={edit.id ? edit.time : time}
            onChange={(e) =>
              edit.id
                ? setEdit({ ...edit, time: e.target.value })
                : setTime(e.target.value)
            }
            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            {edit.id ? "Save Changes" : "Add Task"}
          </button>
        </form>

        <div className="space-y-4">
          {todos.map((todo) => (
            <div
              key={todo._id}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                todo.completed
                  ? "bg-gray-50 line-through text-gray-400"
                  : "bg-white"
              }`}
            >
              <div className="flex items-center space-x-4 flex-1">
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleComplete(todo._id)}
                  className="h-5 w-5 accent-blue-500"
                />
                <div className="flex-1">
                  <p className="text-gray-800">{todo.text}</p>
                  <p className="text-sm text-gray-500">
                    ⏰{" "}
                    {new Date(`2000-01-01T${todo.time}`).toLocaleTimeString(
                      [],
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      }
                    )}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => startEdit(todo)}
                  className="text-blue-500 hover:text-blue-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteTodo(todo._id)}
                  className="text-red-500 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {isRinging && (
          <div className="fixed bottom-4 right-4 animate-pulse">
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                stopAlarm();
              }}
              className="bg-red-500 text-white px-6 py-3 rounded-full shadow-lg hover:bg-red-600 transition-colors"
            >
              ⏰ Stop Alarm
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Todo;
