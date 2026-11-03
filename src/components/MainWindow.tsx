import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  LogOut,
  Server,
  Search,
  CheckCircle,
  PauseCircle,
  ListTodo,
  Layers,
  Sparkles,
  Activity,
  KeyRound,
  ClipboardPaste,
  X,
  Loader2,
  Pin,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { api, ApiEnvKey } from "../services/api";
import { ITask } from "../types/task";
import { TaskCard } from "./TaskCard";
import { LoginForm } from "./LoginForm";
import { NetworkInspector } from "./NetworkInspector";
import { networkLogger } from "../services/networkLogger";
import { toPersianDigits } from "../utils/number";

interface MainWindowProps {
  isAuthenticated: boolean;
  tasks: ITask[];
  pinnedTaskId?: string | null;
  onTogglePinTask?: (taskId: string) => void;
  onClearPinTask?: () => void;
  loading: boolean;
  userFullName: string;
  onRefresh: () => void;
  onLogout: () => void;
  onLoginSuccess: () => void;
}

export const MainWindow: React.FC<MainWindowProps> = ({
  isAuthenticated,
  tasks,
  pinnedTaskId = null,
  onTogglePinTask,
  onClearPinTask,
  loading,
  userFullName,
  onRefresh,
  onLogout,
  onLoginSuccess,
}) => {
  const [currentEnvKey, setCurrentEnvKey] = useState<ApiEnvKey>(
    api.getEnvironment().key
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"all" | "inProgress" | "stopped" | "todo">("all");
  const [showNetworkInspector, setShowNetworkInspector] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [requestCount, setRequestCount] = useState(networkLogger.getLogs().length);
  const [isDevMode, setIsDevMode] = useState<boolean>(
    () => localStorage.getItem("gozareshgir_dev_mode") === "true"
  );

  useEffect(() => {
    const handleStorage = () => {
      setIsDevMode(localStorage.getItem("gozareshgir_dev_mode") === "true");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    return networkLogger.subscribe((logs) => setRequestCount(logs.length));
  }, []);

  const handleEnvChange = (env: ApiEnvKey) => {
    setCurrentEnvKey(env);
    api.setEnvironment(env);
    onRefresh();
  };

  const handleApplyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setTokenError("لطفاً توکن یا کوکی را وارد نمایید.");
      return;
    }

    try {
      setTokenLoading(true);
      setTokenError(null);
      await api.applyToken(tokenInput.trim());
      setShowTokenModal(false);
      setTokenInput("");
      onRefresh();
    } catch (err: any) {
      setTokenError(err.message || "خطا در اعمال توکن");
    } finally {
      setTokenLoading(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTokenInput(text.trim());
        setTokenError(null);
      }
    } catch {
      setTokenError("دسترسی به کلیپ‌بورد امکان‌پذیر نشد. لطفاً دستی Paste کنید.");
    }
  };

  // Status helpers
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

  // Grouped task stats
  const inProgressTasks = tasks.filter(isTaskInProgress);
  const stoppedTasks = tasks.filter(isTaskStopped);
  const todoTasks = tasks.filter(isTaskTodo);

  // Active Pinned Task
  const pinnedTask = pinnedTaskId ? tasks.find((t) => t.id === pinnedTaskId) || null : null;

  // Filtering logic
  const filteredTasks = tasks.filter((task) => {
    if (activeTab === "inProgress" && !isTaskInProgress(task)) return false;
    if (activeTab === "stopped" && !isTaskStopped(task)) return false;
    if (activeTab === "todo" && !isTaskTodo(task)) return false;

    if (filterPriority !== "all" && task.priority !== filterPriority) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchBadge = task.badge?.toLowerCase().includes(q);
      const matchSkill = task.skillType?.toLowerCase().includes(q);
      return matchTitle || !!matchBadge || !!matchSkill;
    }

    return true;
  });

  return (
    <div className="w-full h-screen bg-zinc-950 text-white flex flex-col font-sans select-none overflow-hidden text-right">
      {/* Top App Header */}
      <header className="h-14 border-b border-white/10 px-6 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-base shadow-lg shadow-emerald-900/30">
            گ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm tracking-tight text-white">
                گزارش‌گیر
              </h1>
              <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-mono">
                Desktop
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">میز کار و پایش تسک‌های اجرایی</p>
          </div>
        </div>

        {/* Environment Switcher & Actions */}
        <div className="flex items-center gap-3">
          {/* Environment Switcher */}
          <div className="flex items-center bg-zinc-900 border border-white/10 rounded-xl p-0.5 text-xs">
            <button
              onClick={() => handleEnvChange("dadmehrg")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentEnvKey === "dadmehrg"
                  ? "bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>تست (dadmehrg)</span>
            </button>
            <button
              onClick={() => handleEnvChange("gozareshgir")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentEnvKey === "gozareshgir"
                  ? "bg-teal-500/20 text-teal-300 font-medium border border-teal-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>اصلی (gozareshgir)</span>
            </button>
          </div>

          {/* Toggle Top Notch Button */}
          <button
            onClick={() => invoke("toggle_notch_visibility")}
            title="نمایش یا پنهان کردن ویجت بالای صفحه (ناچ)"
            className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>ویجت ناچ</span>
          </button>

          {/* Network Inspector Button (Only in Dev Mode) */}
          {isDevMode && (
            <button
              onClick={() => setShowNetworkInspector(true)}
              title="بررسی ترافیک شبکه و درخواست‌ها"
              className="flex items-center gap-1.5 text-xs text-sky-300 hover:text-white bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-sans"
            >
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>لاگ شبکه ({requestCount})</span>
            </button>
          )}

          {/* Token Modal Button */}
          <button
            onClick={() => {
              setTokenInput(api.getRawCookie() || api.getAspNetCoreCookie() || api.getAccessToken() || "");
              setTokenError(null);
              setShowTokenModal(true);
            }}
            title="ویرایش یا ثبت توکن / کوکی"
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-sans"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>تنظیم کوکی / توکن</span>
          </button>

          {/* Refresh Button */}
          {isAuthenticated && (
            <button
              onClick={onRefresh}
              title="به‌روزرسانی اطلاعات"
              className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          )}

          {/* User Profile & Logout */}
          {isAuthenticated && (
            <div className="flex items-center gap-2 pl-2 border-r border-white/10">
              <span className="text-xs text-zinc-300 font-medium">
                {userFullName || "کاربر گزارش‌گیر"}
              </span>
              <button
                onClick={onLogout}
                title="خروج از حساب"
                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {!isAuthenticated ? (
          <div className="max-w-md mx-auto my-8 bg-zinc-900/90 border border-white/10 rounded-2xl p-2 shadow-2xl">
            <LoginForm onSuccess={onLoginSuccess} />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-5">
            {/* Active Pinned Banner (if a task is pinned to Notch) */}
            {pinnedTask && (
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 rounded-2xl text-xs text-emerald-300 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Pin className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                  </div>
                  <span className="text-zinc-400">تسک انتخابی شما در ناچ بالای صفحه:</span>
                  <span className="font-bold text-white truncate max-w-lg">{pinnedTask.title}</span>
                </div>
                <button
                  type="button"
                  onClick={onClearPinTask}
                  className="shrink-0 text-[11px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-1 rounded-xl border border-emerald-500/40 cursor-pointer transition-colors"
                >
                  حذف پین (بازگشت به حالت خودکار)
                </button>
              </div>
            )}

            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-4">
              <div
                onClick={() => setActiveTab("all")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  activeTab === "all"
                    ? "bg-zinc-900 border-white/20 shadow-md"
                    : "bg-zinc-900/40 border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between text-zinc-400 mb-1">
                  <span className="text-xs font-medium">همه تسک‌ها</span>
                  <ListTodo className="w-4 h-4" />
                </div>
                <div className="text-2xl font-bold font-mono text-white">
                  {toPersianDigits(tasks.length)}
                </div>
              </div>

              <div
                onClick={() => setActiveTab("inProgress")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  activeTab === "inProgress"
                    ? "bg-emerald-950/30 border-emerald-500/40 shadow-md shadow-emerald-950/50"
                    : "bg-emerald-950/10 border-emerald-500/10 hover:border-emerald-500/20"
                }`}
              >
                <div className="flex items-center justify-between text-emerald-400 mb-1">
                  <span className="text-xs font-medium">در حال اجرا</span>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  {toPersianDigits(inProgressTasks.length)}
                </div>
              </div>

              <div
                onClick={() => setActiveTab("stopped")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  activeTab === "stopped"
                    ? "bg-amber-950/30 border-amber-500/40 shadow-md shadow-amber-950/50"
                    : "bg-amber-950/10 border-amber-500/10 hover:border-amber-500/20"
                }`}
              >
                <div className="flex items-center justify-between text-amber-400 mb-1">
                  <span className="text-xs font-medium">متوقف شده</span>
                  <PauseCircle className="w-4 h-4" />
                </div>
                <div className="text-2xl font-bold font-mono text-amber-400">
                  {toPersianDigits(stoppedTasks.length)}
                </div>
              </div>

              <div
                onClick={() => setActiveTab("todo")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  activeTab === "todo"
                    ? "bg-blue-950/30 border-blue-500/40 shadow-md shadow-blue-950/50"
                    : "bg-blue-950/10 border-blue-500/10 hover:border-blue-500/20"
                }`}
              >
                <div className="flex items-center justify-between text-blue-400 mb-1">
                  <span className="text-xs font-medium">برای انجام</span>
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div className="text-2xl font-bold font-mono text-blue-400">
                  {toPersianDigits(todoTasks.length)}
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex items-center justify-between gap-4 bg-zinc-900/50 border border-white/5 p-3 rounded-2xl">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو در تسک‌ها و پروژه‌ها..."
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 pr-10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
                <Search className="w-4 h-4 text-zinc-500 absolute right-3.5 top-2.5 pointer-events-none" />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">اولویت:</span>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                >
                  <option value="all">همه اولویت‌ها</option>
                  <option value="Critical">بحرانی (Critical)</option>
                  <option value="High">بالا (High)</option>
                  <option value="Normal">معمولی (Normal)</option>
                  <option value="Low">پایین (Low)</option>
                </select>
              </div>
            </div>

            {/* Tasks Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isActive={isTaskInProgress(task)}
                    isPinned={task.id === pinnedTaskId}
                    onTogglePin={() => onTogglePinTask?.(task.id)}
                  />
                ))
              ) : (
                <div className="col-span-full py-16 text-center text-zinc-500 text-sm">
                  تسکی با معیارهای انتخابی یافت نشد.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Network Inspector Modal */}
      <NetworkInspector
        isOpen={showNetworkInspector}
        onClose={() => setShowNetworkInspector(false)}
      />

      {/* Direct Token Setting Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-sans text-right animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl p-5 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">تنظیم مستقیم توکن دسترسی</h3>
                  <p className="text-[11px] text-zinc-400">ثبت accessToken یا کوکی برای فراخوانی APIها</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTokenModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyToken} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-zinc-300">
                    رشته توکن یا کوکی
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>جای‌گذاری از کلیپ‌بورد</span>
                  </button>
                </div>
                <textarea
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="توکن accessToken، رشته Bearer یا کوکی .AspNetCore.Cookies را اینجا Paste کنید..."
                  rows={4}
                  dir="ltr"
                  autoFocus
                  className="w-full rounded-xl bg-zinc-900/90 border border-white/10 p-3 text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-left resize-none"
                />
              </div>

              {tokenError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                  {tokenError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white bg-zinc-900 border border-white/10 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={tokenLoading}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 cursor-pointer disabled:opacity-50"
                >
                  {tokenLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>اعمال و بروزرسانی تسک‌ها</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
