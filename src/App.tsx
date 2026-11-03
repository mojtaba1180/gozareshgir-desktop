import { useState, useEffect, useCallback, useRef } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { api } from "./services/api";
import { ITask } from "./types/task";
import { NotchBar } from "./components/NotchBar";
import { MainWindow } from "./components/MainWindow";

const PINNED_TASK_KEY = "gozareshgir_pinned_task_id";
const CACHED_TASKS_KEY = "gozareshgir_cached_tasks";

export function App() {
  const [view] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("view") || "main";
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    api.isAuthenticated()
  );

  // Initialize tasks from cache if available so Notch renders immediately
  const [tasks, setTasks] = useState<ITask[]>(() => {
    try {
      const cached = localStorage.getItem(CACHED_TASKS_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [pinnedTaskId, setPinnedTaskId] = useState<string | null>(() =>
    localStorage.getItem(PINNED_TASK_KEY) || null
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [userFullName, setUserFullName] = useState<string>(() =>
    api.getUserFullName() || ""
  );

  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);

  const fetchTasks = useCallback(async (force = false) => {
    if (!api.isAuthenticated()) {
      setTasks([]);
      return;
    }

    const now = Date.now();
    // Guard against concurrent execution
    if (isFetchingRef.current) {
      return;
    }
    // Throttle: don't allow fetching more often than once every 3 seconds unless forced
    if (!force && now - lastFetchTimeRef.current < 3000) {
      return;
    }

    isFetchingRef.current = true;
    lastFetchTimeRef.current = now;

    try {
      setLoading(true);
      const res = await api.getExecuteBoard();
      const items: ITask[] =
        (Array.isArray(res?.data?.items) && res.data.items) ||
        (Array.isArray(res?.data) && (res.data as any)) ||
        (Array.isArray(res?.items) && (res.items as any)) ||
        [];

      setTasks(items);
      try {
        localStorage.setItem(CACHED_TASKS_KEY, JSON.stringify(items));
      } catch {
        // quota ignore
      }

      // Broadcast sync across windows (Main <-> Notch)
      emit("tasks-sync", {
        tasks: items,
        pinnedTaskId: localStorage.getItem(PINNED_TASK_KEY) || null,
        userFullName: api.getUserFullName() || "",
        isAuthenticated: true,
      }).catch(() => {});
    } catch (err) {
      console.error("Failed to fetch execute board:", err);
      if (!api.isAuthenticated()) {
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Listen to cross-window Tauri events
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<any>("tasks-sync", (event) => {
      if (event.payload?.tasks) {
        setTasks(event.payload.tasks);
      }
      if (event.payload?.pinnedTaskId !== undefined) {
        setPinnedTaskId(event.payload.pinnedTaskId);
      }
      if (event.payload?.userFullName) {
        setUserFullName(event.payload.userFullName);
      }
      if (event.payload?.isAuthenticated !== undefined) {
        setIsAuthenticated(event.payload.isAuthenticated);
      }
    }).then((u) => {
      unlisten = u;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Listen to cross-window storage events (login, logout, env switch)
  // CRITICAL: Filter by e.key to prevent infinite cross-window ping-pong loop!
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // 1. If cached tasks was updated by the other window, update state WITHOUT hitting the network!
      if (e.key === CACHED_TASKS_KEY) {
        if (e.newValue) {
          try {
            setTasks(JSON.parse(e.newValue));
          } catch {}
        }
        return;
      }

      // 2. If pinned task changed, update state WITHOUT hitting the network!
      if (e.key === PINNED_TASK_KEY) {
        setPinnedTaskId(e.newValue || null);
        return;
      }

      // 3. Ignore internal cookie/log keys that happen during API calls
      if (
        e.key === ".AspNetCore.Cookies" ||
        e.key === "gozareshgir_raw_cookie" ||
        e.key === "accountId" ||
        e.key === "fullName"
      ) {
        return;
      }

      // 4. Only re-fetch if authentication or environment genuinely changed
      const isAuth = api.isAuthenticated();
      setIsAuthenticated(isAuth);
      setUserFullName(api.getUserFullName() || "");
      if (isAuth) {
        fetchTasks(true);
      } else {
        setTasks([]);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [fetchTasks]);

  // Polling every 15-20 seconds if authenticated (staggered to prevent overlap)
  useEffect(() => {
    if (!isAuthenticated) return;

    // Initial fetch on mount
    fetchTasks(false);

    // Main window polls every 15s; Notch window polls every 25s as fallback
    const pollIntervalMs = view === "main" ? 15000 : 25000;
    const interval = setInterval(() => {
      fetchTasks(false);
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchTasks, view]);

  const handleTogglePinTask = (taskId: string) => {
    const nextId = pinnedTaskId === taskId ? null : taskId;
    setPinnedTaskId(nextId);
    if (nextId) {
      localStorage.setItem(PINNED_TASK_KEY, nextId);
    } else {
      localStorage.removeItem(PINNED_TASK_KEY);
    }

    emit("tasks-sync", {
      tasks,
      pinnedTaskId: nextId,
      userFullName,
      isAuthenticated,
    }).catch(() => {});
  };

  const handleClearPin = () => {
    setPinnedTaskId(null);
    localStorage.removeItem(PINNED_TASK_KEY);
    emit("tasks-sync", {
      tasks,
      pinnedTaskId: null,
      userFullName,
      isAuthenticated,
    }).catch(() => {});
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setUserFullName(api.getUserFullName() || "");
    fetchTasks();
  };

  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
    setTasks([]);
    setPinnedTaskId(null);
    localStorage.removeItem(PINNED_TASK_KEY);
    localStorage.removeItem(CACHED_TASKS_KEY);

    emit("tasks-sync", {
      tasks: [],
      pinnedTaskId: null,
      userFullName: "",
      isAuthenticated: false,
    }).catch(() => {});
  };

  // Robust status helpers (case-insensitive & numeric enum support)
  const isTaskInProgress = (t: ITask) => {
    const s = String(t.status || "").toLowerCase();
    return s === "inprogress" || s === "1" || s === "active" || s === "running";
  };

  const isTaskStopped = (t: ITask) => {
    const s = String(t.status || "").toLowerCase();
    return s === "stopped" || s === "2" || s === "paused";
  };

  const isTaskTodo = (t: ITask) => {
    const s = String(t.status || "").toLowerCase();
    return s === "todo" || s === "0" || s === "pending";
  };

  // Which task to display in Notch:
  // 1. Manually pinned task (if set)
  // 2. Otherwise currently active/in-progress task
  const pinnedTask = pinnedTaskId ? tasks.find((t) => t.id === pinnedTaskId) || null : null;
  const inProgressTask = tasks.find(isTaskInProgress) || null;
  const notchActiveTask = pinnedTask || inProgressTask || null;
  const isPinned = !!pinnedTask;

  const stoppedTasks = tasks.filter(isTaskStopped);
  const todoTasks = tasks.filter(isTaskTodo);

  if (view === "notch") {
    return (
      <div className="w-screen h-screen flex justify-center items-start bg-transparent overflow-hidden">
        <NotchBar
          activeTask={notchActiveTask}
          isPinned={isPinned}
          totalTasksCount={tasks.length}
          allTasks={tasks}
          stoppedTasks={stoppedTasks}
          todoTasks={todoTasks}
          loading={loading}
          userFullName={userFullName}
          pinnedTaskId={pinnedTaskId}
          onRefresh={fetchTasks}
          onTogglePinTask={handleTogglePinTask}
          onClearPin={handleClearPin}
          onLogout={handleLogout}
        />
      </div>
    );
  }

  return (
    <MainWindow
      isAuthenticated={isAuthenticated}
      tasks={tasks}
      pinnedTaskId={pinnedTaskId}
      onTogglePinTask={handleTogglePinTask}
      onClearPinTask={handleClearPin}
      loading={loading}
      userFullName={userFullName}
      onRefresh={fetchTasks}
      onLogout={handleLogout}
      onLoginSuccess={handleLoginSuccess}
    />
  );
}

export default App;
