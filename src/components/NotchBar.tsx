import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  LayoutDashboard,
  Layers,
  Clock,
  Settings,
  RefreshCw,
  ExternalLink,
  Pin,
  X,
  ChevronDown,
  AlertTriangle,
  Search,
  LogOut,
  Activity,
  Terminal,
  ListTodo,
  Check,
  Server,
  Minimize2,
  Maximize2,
  Compass,
  Code2,
  Monitor,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ITask } from "../types/task";
import { formatTimeSpan } from "../utils/number";
import { api, ApiEnvKey, ENVIRONMENTS } from "../services/api";
import { TaskCard } from "./TaskCard";
import {
  NotchLeftWing,
  NotchRightWing,
  NotchItem,
  type NotchItemData,
} from "./NotchNav";

export type NotchTab = "overview" | "tasks" | "insights" | "settings";

export type NotchPosition =
  | "top-center"
  | "top-left"
  | "top-right"
  | "bottom-center"
  | "bottom-left"
  | "bottom-right";

const NOTCH_POSITION_KEY = "gozareshgir_notch_position";
const SUPER_MINIMIZE_KEY = "gozareshgir_notch_super_minimized";
const DEV_MODE_KEY = "gozareshgir_dev_mode";
const TARGET_DISPLAY_KEY = "gozareshgir_notch_target_display";
const EXPANDED_GAP_KEY = "gozareshgir_notch_expanded_gap";
const EXECUTION_URL = "https://admin.gozareshgir.ir/program-manager/execution";

export interface MonitorInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  is_primary: boolean;
}

interface NotchBarProps {
  activeTask: ITask | null;
  isPinned?: boolean;
  totalTasksCount?: number;
  allTasks?: ITask[];
  stoppedTasks: ITask[];
  todoTasks: ITask[];
  loading: boolean;
  userFullName?: string;
  pinnedTaskId?: string | null;
  onRefresh: () => void;
  onTogglePinTask?: (taskId: string) => void;
  onClearPin?: () => void;
  onLogout?: () => void;
}

export const NotchBar: React.FC<NotchBarProps> = ({
  activeTask,
  isPinned = false,
  totalTasksCount = 0,
  allTasks = [],
  stoppedTasks,
  todoTasks,
  loading,
  userFullName,
  pinnedTaskId,
  onRefresh,
  onTogglePinTask,
  onClearPin,
  onLogout,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<NotchTab>("overview");
  const [taskFilter, setTaskFilter] = useState<"all" | "inProgress" | "stopped" | "todo">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentEnvKey, setCurrentEnvKey] = useState<ApiEnvKey>(api.getEnvironment().key);

  // Position state (persisted)
  const [position, setPosition] = useState<NotchPosition>(() => {
    return (localStorage.getItem(NOTCH_POSITION_KEY) as NotchPosition) || "top-center";
  });

  // Target Display state (persisted) - "all", "main", or monitor id
  const [targetDisplay, setTargetDisplay] = useState<string>(() => {
    return localStorage.getItem(TARGET_DISPLAY_KEY) || "all";
  });
  const [availableMonitors, setAvailableMonitors] = useState<MonitorInfo[]>([]);

  // Expanded drop gap from top (persisted) - default 48px to drop clearly below MacBook 38px notch
  const [expandedTopGap, setExpandedTopGap] = useState<number>(() => {
    const saved = localStorage.getItem(EXPANDED_GAP_KEY);
    return saved ? Number(saved) : 48;
  });

  // Super-minimize state (persisted)
  const [isSuperMinimized, setIsSuperMinimized] = useState<boolean>(() => {
    return localStorage.getItem(SUPER_MINIMIZE_KEY) === "true";
  });

  // Dev mode toggle (persisted) - User requested: "حالت dev رو پاک کن یا سویچ بزار داخل تنظیمات که بتونیم فعال و غیر فعال کنم"
  const [isDevMode, setIsDevMode] = useState<boolean>(() => {
    return localStorage.getItem(DEV_MODE_KEY) === "true";
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch available monitors and sync display visibility on mount
  useEffect(() => {
    try {
      invoke<MonitorInfo[]>("get_available_monitors").then((monitors) => {
        if (monitors && monitors.length > 0) {
          setAvailableMonitors(monitors);
        }
      });
      invoke("set_notch_target_display", { target: targetDisplay });
    } catch {}
  }, []);

  const handleTargetDisplayChange = (target: string) => {
    setTargetDisplay(target);
    localStorage.setItem(TARGET_DISPLAY_KEY, target);
    try {
      invoke("set_notch_target_display", { target });
    } catch (e) {
      console.warn("set_notch_target_display error:", e);
    }
  };

  const handleExpandedTopGapChange = (gap: number) => {
    setExpandedTopGap(gap);
    localStorage.setItem(EXPANDED_GAP_KEY, String(gap));
    if (isExpanded) {
      let windowLabel: string | undefined = undefined;
      try {
        windowLabel = getCurrentWebviewWindow().label;
      } catch {}
      const expandedHeight = 460 + gap + 24;
      invoke("resize_notch", { width: 580, height: expandedHeight, position, label: windowLabel });
    }
  };

  // Resize window via Tauri IPC command whenever expansion, super-minimize or position changes
  useEffect(() => {
    let windowLabel: string | undefined = undefined;
    try {
      windowLabel = getCurrentWebviewWindow().label;
    } catch {}

    const restingWidth = position === "top-center" ? 540 : 380;
    const restingHeight = 38;
    const expandedHeight = 460 + expandedTopGap + 24;

    try {
      if (isExpanded) {
        invoke("resize_notch", { width: 580, height: expandedHeight, position, label: windowLabel });
      } else if (isSuperMinimized) {
        invoke("resize_notch", { width: 80, height: 34, position, label: windowLabel });
      } else {
        const timer = setTimeout(() => {
          invoke("resize_notch", { width: restingWidth, height: restingHeight, position, label: windowLabel });
        }, 240);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.warn("Tauri resize_notch invoke not available:", e);
    }
  }, [isExpanded, isSuperMinimized, position, expandedTopGap]);

  // Update System Status Bar (macOS Tray) with live task status & time
  useEffect(() => {
    try {
      if (activeTask) {
        const isProg =
          activeTask.status === "InProgress" ||
          String(activeTask.status).toLowerCase() === "inprogress";
        const isStop =
          activeTask.status === "Stopped" ||
          String(activeTask.status).toLowerCase() === "stopped";

        const timerStr = activeTask.progress?.remainingTime
          ? formatTimeSpan(activeTask.progress.remainingTime)
          : activeTask.progress?.progressPercentage !== undefined &&
            activeTask.progress.progressPercentage > 0
          ? `${activeTask.progress.progressPercentage}%`
          : "";

        const statusDot = isProg ? "🟢" : isStop ? "🟡" : "🔵";
        const title = timerStr ? `${statusDot} ${timerStr}` : statusDot;
        const tooltip = `${activeTask.title} (${activeTask.badge || "تسک فعال"})`;

        invoke("update_tray_status", { title, tooltip });
      } else {
        invoke("update_tray_status", {
          title: "گزارش‌گیر",
          tooltip: "گزارش‌گیر دسکتاپ - بدون تسک فعال",
        });
      }
    } catch {}
  }, [activeTask]);

  // Listen to Escape key to collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isExpanded) {
          setIsExpanded(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  const handlePositionChange = (pos: NotchPosition) => {
    setPosition(pos);
    localStorage.setItem(NOTCH_POSITION_KEY, pos);
    try {
      const restingWidth = pos === "top-center" ? 540 : 380;
      const expandedHeight = 460 + expandedTopGap + 24;
      const width = isExpanded ? 580 : isSuperMinimized ? 80 : restingWidth;
      const height = isExpanded ? expandedHeight : isSuperMinimized ? 34 : 38;
      invoke("set_notch_position", { position: pos, width, height });
    } catch (e) {
      console.warn("set_notch_position error:", e);
    }
  };

  const handleToggleSuperMinimize = () => {
    const nextVal = !isSuperMinimized;
    setIsSuperMinimized(nextVal);
    localStorage.setItem(SUPER_MINIMIZE_KEY, String(nextVal));
    if (nextVal) {
      setIsExpanded(false);
    }
  };

  const handleToggleDevMode = () => {
    const nextVal = !isDevMode;
    setIsDevMode(nextVal);
    localStorage.setItem(DEV_MODE_KEY, String(nextVal));
    window.dispatchEvent(new Event("storage"));
  };

  // Open direct Execution link in default browser
  const handleOpenExecutionInBrowser = () => {
    try {
      invoke("open_url", { url: EXECUTION_URL });
    } catch {
      window.open(EXECUTION_URL, "_blank");
    }
  };

  const handleToggleMainWindow = () => {
    try {
      invoke("toggle_main_window");
    } catch (e) {
      console.warn("toggle_main_window invoke error:", e);
    }
  };

  const handleOpenDevTools = () => {
    try {
      invoke("open_devtools");
    } catch (e) {
      console.warn("open_devtools invoke error:", e);
    }
  };

  const handleEnvChange = (env: ApiEnvKey) => {
    setCurrentEnvKey(env);
    api.setEnvironment(env);
    onRefresh();
  };

  const isTaskActive =
    activeTask &&
    (activeTask.status === "InProgress" ||
      String(activeTask.status).toLowerCase() === "inprogress");

  const isTaskStopped =
    activeTask &&
    (activeTask.status === "Stopped" ||
      String(activeTask.status).toLowerCase() === "stopped");

  // Filter tasks for the tasks tab
  const filteredTasks = allTasks.filter((t) => {
    const status = String(t.status || "").toLowerCase();
    const matchesFilter =
      taskFilter === "all" ||
      (taskFilter === "inProgress" && (status === "inprogress" || status === "1" || status === "active")) ||
      (taskFilter === "stopped" && (status === "stopped" || status === "2" || status === "paused")) ||
      (taskFilter === "todo" && (status === "todo" || status === "0" || status === "pending"));

    if (!matchesFilter) return false;

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (t.title && t.title.toLowerCase().includes(query)) ||
      (t.badge && t.badge.toLowerCase().includes(query)) ||
      (t.skillType && t.skillType.toLowerCase().includes(query)) ||
      (t.path && t.path.some((p) => p.toLowerCase().includes(query)))
    );
  });

  const inProgressCount = allTasks.filter(
    (t) => String(t.status).toLowerCase() === "inprogress"
  ).length;

  // Placement styling helpers
  const isBottom = position.startsWith("bottom");
  const isCenter = position === "top-center" || position === "bottom-center";

  const getBorderRadius = () => {
    if (isSuperMinimized) return "rounded-full";
    if (isExpanded) {
      return "rounded-[28px]";
    }
    if (position === "top-center") return "rounded-b-[20px] rounded-t-none";
    if (position === "bottom-center") return "rounded-t-[20px] rounded-b-none";
    return "rounded-2xl";
  };

  // Notch Navigation Item Data
  const navItems: NotchItemData[] = [
    {
      id: "overview",
      label: "پیشخوان",
      icon: LayoutDashboard,
      badge: activeTask ? "ON" : undefined,
    },
    {
      id: "tasks",
      label: "تسک‌ها",
      icon: Layers,
      badge: allTasks.length > 0 ? String(allTasks.length) : undefined,
    },
    {
      id: "insights",
      label: "کارکرد",
      icon: Clock,
    },
    {
      id: "settings",
      label: "تنظیمات",
      icon: Settings,
    },
  ];

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex select-none font-sans ${
        position === "top-left" || position === "bottom-left"
          ? "justify-start"
          : position === "top-right" || position === "bottom-right"
          ? "justify-end"
          : "justify-center"
      } ${isBottom ? "items-end" : "items-start"}`}
      dir="rtl"
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.8 }}
        style={{
          marginTop: isExpanded && !isBottom ? `${expandedTopGap}px` : undefined,
          marginBottom: isExpanded && isBottom ? "14px" : undefined,
        }}
        className={`relative bg-[#08090c]/95 border border-white/10 shadow-2xl text-white overflow-visible ${
          isExpanded
            ? "rounded-[28px] w-full max-w-[580px] shadow-black/90 backdrop-blur-3xl"
            : isSuperMinimized
            ? `${getBorderRadius()} w-[80px] h-[34px] cursor-pointer hover:border-emerald-500/50 hover:scale-105 transition-all shadow-emerald-950/40`
            : `${getBorderRadius()} ${position === "top-center" ? "w-[540px]" : "w-[380px]"} cursor-pointer hover:bg-black/95 transition-all`
        }`}
      >
        {/* =========================================================================
            ORGANIC CONCAVE WINGS (APPLE NOTCH CUTOUTS)
            Rendered for top-center and bottom-center placements ONLY when resting
           ========================================================================= */}
        {isCenter && !isSuperMinimized && !isExpanded && (
          <>
            <NotchLeftWing position={isBottom ? "bottom" : "top"} />
            <NotchRightWing position={isBottom ? "bottom" : "top"} />
          </>
        )}

        {/* =========================================================================
            STATE 1: SUPER MINIMIZED BADGE (Floating Micro-Pill)
           ========================================================================= */}
        {isSuperMinimized ? (
          <div
            onClick={handleToggleSuperMinimize}
            className="w-full h-full px-2 flex items-center justify-between text-white group"
            title="کلیک برای بازگشت به حالت کامل ناچ"
          >
            <div className="flex items-center gap-1.5">
              {isTaskActive ? (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              ) : isTaskStopped ? (
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              )}

              <span className="font-mono text-[11px] font-semibold text-emerald-400">
                {activeTask?.progress?.remainingTime
                  ? formatTimeSpan(activeTask.progress.remainingTime)
                  : activeTask?.progress?.progressPercentage !== undefined &&
                    activeTask.progress.progressPercentage > 0
                  ? `${activeTask.progress.progressPercentage}%`
                  : activeTask
                  ? "ON"
                  : "--:--"}
              </span>
            </div>

            <Maximize2 className="w-3 h-3 text-zinc-400 group-hover:text-white transition-colors" />
          </div>
        ) : !isExpanded ? (
          /* =========================================================================
              STATE 2: COMPACT RESTING NOTCH BAR (MacBook Hardware Notch Optimized)
             ========================================================================= */
          <div
            onClick={() => setIsExpanded(true)}
            className="h-[38px] px-3.5 flex items-center justify-between text-white group relative w-full cursor-pointer select-none"
            dir="ltr"
            title="کلیک برای باز کردن منوی ناچ"
          >
            {/* LEFT WING: Status Beacon, Task Title, Pin Badge */}
            <div className="flex items-center gap-2 overflow-hidden max-w-[165px] shrink-0" dir="rtl">
              {activeTask ? (
                <>
                  {isTaskActive ? (
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                  ) : isTaskStopped ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
                  )}

                  <span
                    className="text-xs font-semibold text-white/95 truncate group-hover:text-white transition-colors"
                    title={activeTask.title}
                  >
                    {activeTask.title}
                  </span>

                  {isPinned && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearPin?.();
                      }}
                      title="پین شده (کلیک برای خروج از پین)"
                      className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-500/20 text-[9px] text-emerald-300 font-medium shrink-0"
                    >
                      <Pin className="w-2.5 h-2.5 fill-emerald-400 text-emerald-400" />
                    </button>
                  )}
                </>
              ) : stoppedTasks.length > 0 ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-xs text-amber-200/90 truncate">
                    {stoppedTasks.length} تسک متوقف
                  </span>
                </>
              ) : totalTasksCount > 0 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-xs text-zinc-300 truncate">
                    {totalTasksCount} تسک در انتظار
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-zinc-500 shrink-0" />
                  <span className="text-xs text-zinc-400 truncate">بدون تسک فعال</span>
                </>
              )}
            </div>

            {/* CENTER BRIDGE: MacBook Physical Hardware Notch Spacer (Empty Black Area) */}
            {position === "top-center" && (
              <div
                className="flex-1 min-w-[180px] max-w-[210px] h-full pointer-events-none flex items-center justify-center"
                aria-hidden="true"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white/10 opacity-30" />
              </div>
            )}

            {/* RIGHT WING: Time Pill, Super-Minimize button, Refresh & Expand */}
            <div className="flex items-center gap-1.5 shrink-0 justify-end max-w-[165px]" dir="ltr">
              {activeTask?.progress?.remainingTime ? (
                <div className="flex items-center gap-1 bg-white/10 border border-white/15 px-2 py-0.5 rounded-full font-mono text-[11px] text-emerald-400 font-medium shadow-sm">
                  <Clock className="w-3 h-3 text-emerald-400/90" />
                  <span>{formatTimeSpan(activeTask.progress.remainingTime)}</span>
                </div>
              ) : activeTask?.progress?.progressPercentage !== undefined &&
                activeTask.progress.progressPercentage > 0 ? (
                <div className="bg-white/10 border border-white/15 px-2 py-0.5 rounded-full font-mono text-[11px] text-emerald-400 font-medium">
                  {activeTask.progress.progressPercentage}%
                </div>
              ) : null}

              {/* Super-minimize button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleSuperMinimize();
                }}
                title="حالت سوپر مینیمایز (بج کوچک)"
                className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh();
                }}
                title="به‌روزرسانی اطلاعات"
                className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    loading ? "animate-spin text-emerald-400" : ""
                  }`}
                />
              </button>

              <div
                title="کلیک برای باز کردن ناچ"
                className="p-0.5 text-zinc-400 group-hover:text-white transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
              STATE 3: EXPANDED COUCOU-STYLE ISLAND WITH NOTCH NAV TABS
             ========================================================================= */
          <div className="flex flex-col">
            {/* Header: Tabs with NotchItem + Action icons */}
            <div className="h-[44px] px-3 border-b border-white/10 flex items-center justify-between text-white bg-white/[0.02]">
              {/* Right: Tabs Navigation with Animated Sliding Spring Pill */}
              <LayoutGroup id="notch-tab-group">
                <div className="flex items-center gap-0.5">
                  {navItems.map((item) => (
                    <NotchItem
                      key={item.id}
                      id={item.id}
                      label={item.label}
                      icon={item.icon}
                      badge={item.badge}
                      isActive={activeTab === item.id}
                      onSelect={(id) => setActiveTab(id as NotchTab)}
                    />
                  ))}
                </div>
              </LayoutGroup>

              {/* Left: Action Icons */}
              <div className="flex items-center gap-1.5">
                {activeTask?.progress?.remainingTime && (
                  <div className="hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-mono text-[10px] text-emerald-400">
                    <Clock className="w-3 h-3 text-emerald-400/80" />
                    <span>{formatTimeSpan(activeTask.progress.remainingTime)}</span>
                  </div>
                )}

                {/* Pin active task toggle */}
                {activeTask && onTogglePinTask && (
                  <button
                    type="button"
                    onClick={() => onTogglePinTask(activeTask.id)}
                    title={isPinned ? "حذف از پین ناچ" : "پین کردن در ناچ"}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      isPinned
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border-white/10"
                    }`}
                  >
                    <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-emerald-400" : ""}`} />
                  </button>
                )}

                {/* Refresh */}
                <button
                  type="button"
                  onClick={onRefresh}
                  title="به‌روزرسانی اطلاعات"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition-all cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      loading ? "animate-spin text-emerald-400" : ""
                    }`}
                  />
                </button>

                {/* Direct Link to Execution Board in Browser ↗ */}
                <button
                  type="button"
                  onClick={handleOpenExecutionInBrowser}
                  title="ورود مستقیم به پنل وب گزارش‌گیر (مرورگر)"
                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>

                {/* Close / Fold Button (✕) */}
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  title="بستن منو (Esc)"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Expanded Content Area */}
            <div className="p-3.5 max-h-[380px] overflow-y-auto">
              <AnimatePresence mode="wait">
                {/* ── TAB 1: OVERVIEW (پیشخوان) ─────────────────────────────────── */}
                {activeTab === "overview" && (
                  <motion.div
                    key="tab-overview"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16 }}
                    className="space-y-3"
                  >
                    {activeTask ? (
                      <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-3.5 shadow-lg">
                        {/* Top Badges */}
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isTaskActive ? (
                              <span className="flex items-center gap-1 text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </span>
                                در حال انجام
                              </span>
                            ) : isTaskStopped ? (
                              <span className="flex items-center gap-1 text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                متوقف شده
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                                برای انجام
                              </span>
                            )}

                            {activeTask.badge && (
                              <span className="text-[11px] font-mono bg-white/10 border border-white/15 text-zinc-300 px-2 py-0.5 rounded-md">
                                {activeTask.badge}
                              </span>
                            )}

                            {activeTask.skillType && (
                              <span className="text-[10px] bg-white/5 border border-white/10 text-zinc-400 px-1.5 py-0.5 rounded">
                                {activeTask.skillType}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isPinned && (
                              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-[10px] text-emerald-300 font-medium">
                                <Pin className="w-2.5 h-2.5 fill-emerald-400" />
                                <span>پین شده</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title & Path */}
                        <h3 className="text-sm font-bold text-white mb-1.5 leading-snug">
                          {activeTask.title}
                        </h3>

                        {activeTask.path && activeTask.path.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-3 flex-wrap">
                            {activeTask.path.map((segment, idx) => (
                              <React.Fragment key={idx}>
                                {idx > 0 && <span className="text-zinc-600">/</span>}
                                <span className="bg-white/5 px-1.5 py-0.5 rounded">
                                  {segment}
                                </span>
                              </React.Fragment>
                            ))}
                          </div>
                        )}

                        {/* Timers Grid */}
                        <div className="grid grid-cols-2 gap-2 my-3">
                          <div className="bg-black/40 border border-white/5 rounded-xl p-2.5 text-center">
                            <span className="text-[10px] text-zinc-400 block mb-1">
                              زمان مصرف‌شده
                            </span>
                            <span className="font-mono text-sm font-semibold text-zinc-200">
                              {formatTimeSpan(activeTask.progress?.elapsedTime)}
                            </span>
                          </div>
                          <div className="bg-black/40 border border-white/5 rounded-xl p-2.5 text-center">
                            <span className="text-[10px] text-zinc-400 block mb-1">
                              زمان باقی‌مانده
                            </span>
                            <span className="font-mono text-sm font-semibold text-emerald-400">
                              {formatTimeSpan(activeTask.progress?.remainingTime)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {activeTask.progress?.progressPercentage !== undefined && (
                          <div className="mt-2.5">
                            <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1">
                              <span>پیشرفت کار</span>
                              <span className="font-mono text-emerald-400 font-medium">
                                {activeTask.progress.progressPercentage}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    activeTask.progress.progressPercentage
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Taskino Checklist (if available) */}
                        {activeTask.taskino?.items && activeTask.taskino.items.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                              <span>زیرتسک‌ها و چک‌لیست:</span>
                              <span className="font-mono text-[10px]">
                                {activeTask.taskino.items.filter((i) => i.isDone).length} از{" "}
                                {activeTask.taskino.items.length}
                              </span>
                            </div>
                            <div className="space-y-1 max-h-[85px] overflow-y-auto pr-0.5">
                              {activeTask.taskino.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg bg-black/20"
                                >
                                  <span
                                    className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 ${
                                      item.isDone
                                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                        : "border border-zinc-600"
                                    }`}
                                  >
                                    {item.isDone && <Check className="w-2.5 h-2.5" />}
                                  </span>
                                  <span
                                    className={`truncate ${
                                      item.isDone
                                        ? "line-through text-zinc-500"
                                        : "text-zinc-200"
                                    }`}
                                  >
                                    {item.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action buttons footer */}
                        <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
                          {/* Direct Link to Execution in Browser as requested */}
                          <button
                            type="button"
                            onClick={handleOpenExecutionInBrowser}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-xs text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>نمایش کامل در میز کار (ورود به پنل وب ↗)</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleToggleMainWindow}
                              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-zinc-300 border border-white/10 transition-all cursor-pointer"
                              title="باز کردن نرم‌افزار دسکتاپ"
                            >
                              میز کار دسکتاپ
                            </button>

                            {onTogglePinTask && (
                              <button
                                type="button"
                                onClick={() => onTogglePinTask(activeTask.id)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                                  isPinned
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                    : "bg-white/10 text-white border border-white/20"
                                }`}
                              >
                                <Pin className="w-3.5 h-3.5" />
                                <span>{isPinned ? "حذف پین" : "پین"}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Empty state */
                      <div className="text-center py-6 px-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-zinc-400">
                          <ListTodo className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-semibold text-white mb-1">
                          هیچ تسکی در حال حاضر فعال نیست
                        </h4>
                        <p className="text-xs text-zinc-400 max-w-[280px] mx-auto mb-4">
                          می‌توانید وارد پنل وب شوید یا یکی از تسک‌های زیر را پین کنید.
                        </p>

                        <button
                          type="button"
                          onClick={handleOpenExecutionInBrowser}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-xs text-emerald-300 border border-emerald-500/40 mb-4 transition-all cursor-pointer font-medium"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>باز کردن میز کار در مرورگر (پنل وب)</span>
                        </button>

                        {allTasks.length > 0 && (
                          <div className="space-y-1.5 text-right max-h-[140px] overflow-y-auto">
                            <span className="text-[11px] text-zinc-400 font-medium block mb-1">
                              تسک‌های پیشنهادی برای پین به ناچ:
                            </span>
                            {allTasks.slice(0, 3).map((task) => (
                              <div
                                key={task.id}
                                onClick={() => onTogglePinTask?.(task.id)}
                                className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all cursor-pointer"
                              >
                                <span className="text-xs text-white truncate max-w-[340px]">
                                  {task.title}
                                </span>
                                <button
                                  type="button"
                                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                >
                                  <Pin className="w-2.5 h-2.5" />
                                  <span>پین به ناچ</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── TAB 2: TASKS LIST (تسک‌ها) ─────────────────────────────────── */}
                {activeTab === "tasks" && (
                  <motion.div
                    key="tab-tasks"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16 }}
                    className="space-y-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="جستجوی تسک، عنوان یا شناسه..."
                          className="w-full pr-8 pl-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => setTaskFilter("all")}
                        className={`px-2.5 py-1 rounded-full transition-all cursor-pointer shrink-0 ${
                          taskFilter === "all"
                            ? "bg-white/20 text-white font-medium"
                            : "text-zinc-400 hover:text-white bg-white/5"
                        }`}
                      >
                        همه ({allTasks.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskFilter("inProgress")}
                        className={`px-2.5 py-1 rounded-full transition-all cursor-pointer shrink-0 ${
                          taskFilter === "inProgress"
                            ? "bg-emerald-500/30 text-emerald-300 font-medium border border-emerald-500/40"
                            : "text-zinc-400 hover:text-white bg-white/5"
                        }`}
                      >
                        در حال انجام ({inProgressCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskFilter("stopped")}
                        className={`px-2.5 py-1 rounded-full transition-all cursor-pointer shrink-0 ${
                          taskFilter === "stopped"
                            ? "bg-amber-500/30 text-amber-300 font-medium border border-amber-500/40"
                            : "text-zinc-400 hover:text-white bg-white/5"
                        }`}
                      >
                        متوقف شده ({stoppedTasks.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskFilter("todo")}
                        className={`px-2.5 py-1 rounded-full transition-all cursor-pointer shrink-0 ${
                          taskFilter === "todo"
                            ? "bg-blue-500/30 text-blue-300 font-medium border border-blue-500/40"
                            : "text-zinc-400 hover:text-white bg-white/5"
                        }`}
                      >
                        برای انجام ({todoTasks.length})
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-0.5">
                      {filteredTasks.length > 0 ? (
                        filteredTasks.map((t) => (
                          <TaskCard
                            key={t.id}
                            task={t}
                            isActive={activeTask?.id === t.id}
                            isPinned={pinnedTaskId === t.id}
                            onTogglePin={
                              onTogglePinTask ? () => onTogglePinTask(t.id) : undefined
                            }
                          />
                        ))
                      ) : (
                        <div className="text-center py-8 text-zinc-500 text-xs">
                          تسک مطابق با این فیلتر یافت نشد.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ── TAB 3: INSIGHTS (کارکرد و زمان) ─────────────────────────── */}
                {activeTab === "insights" && (
                  <motion.div
                    key="tab-insights"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16 }}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                        <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                          <Activity className="w-3.5 h-3.5 text-emerald-400" />
                          <span>تسک‌های فعال</span>
                        </div>
                        <span className="font-mono text-xl font-bold text-white">
                          {inProgressCount}
                        </span>
                        <span className="text-[10px] text-zinc-500 block mt-0.5">
                          از مجموع {allTasks.length} تسک
                        </span>
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                        <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span>تسک‌های متوقف</span>
                        </div>
                        <span className="font-mono text-xl font-bold text-white">
                          {stoppedTasks.length}
                        </span>
                        <span className="text-[10px] text-zinc-500 block mt-0.5">
                          نیازمند پیگیری
                        </span>
                      </div>
                    </div>

                    {activeTask && (
                      <div className="bg-gradient-to-r from-emerald-950/40 to-teal-950/20 border border-emerald-500/20 rounded-2xl p-3">
                        <span className="text-xs text-emerald-300 font-medium block mb-1">
                          تسک در حال کار:
                        </span>
                        <p className="text-xs text-white truncate mb-2">
                          {activeTask.title}
                        </p>
                        <div className="flex items-center justify-between text-xs text-zinc-300 font-mono">
                          <span>
                            سپری‌شده: {formatTimeSpan(activeTask.progress?.elapsedTime)}
                          </span>
                          <span className="text-emerald-400">
                            باقی‌مانده: {formatTimeSpan(activeTask.progress?.remainingTime)}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-zinc-300">
                        <span>تسک‌های در انتظار:</span>
                        <span className="font-mono font-medium">
                          {todoTasks.length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-300">
                        <span>موقعیت فعال در نمایشگر:</span>
                        <span className="text-emerald-400 font-medium">{position}</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── TAB 4: SETTINGS, POSITION & ACCOUNT (تنظیمات) ─────────────── */}
                {activeTab === "settings" && (
                  <motion.div
                    key="tab-settings"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16 }}
                    className="space-y-3"
                  >
                    {/* User profile */}
                    <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-2xl">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-black font-bold text-sm">
                          {userFullName ? userFullName.slice(0, 1) : "گ"}
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-white block">
                            {userFullName || "کاربر گزارش‌گیر"}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            حساب کاربری متصل
                          </span>
                        </div>
                      </div>

                      {onLogout && (
                        <button
                          type="button"
                          onClick={onLogout}
                          title="خروج از حساب"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs transition-all cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>خروج</span>
                        </button>
                      )}
                    </div>

                    {/* Position Placement Selector */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-300 mb-2">
                        <Compass className="w-3.5 h-3.5 text-emerald-400" />
                        <span>موقعیت نمایش روی صفحه:</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                        {[
                          { key: "top-left", label: "بالا چپ" },
                          { key: "top-center", label: "بالا وسط (ناچ)" },
                          { key: "top-right", label: "بالا راست" },
                          { key: "bottom-left", label: "پایین چپ" },
                          { key: "bottom-center", label: "پایین وسط" },
                          { key: "bottom-right", label: "پایین راست" },
                        ].map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => handlePositionChange(p.key as NotchPosition)}
                            className={`py-1.5 px-2 rounded-xl border transition-all cursor-pointer text-[11px] ${
                              position === p.key
                                ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50 font-medium shadow-sm"
                                : "bg-black/20 text-zinc-400 border-white/5 hover:border-white/15 hover:text-white"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Display Monitor Selection - User Requested */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="font-medium">نمایش در مانیتور:</span>
                        </div>
                        <span className="text-[10px] text-zinc-400">
                          {targetDisplay === "all"
                            ? "همه مانیتورها"
                            : targetDisplay === "main"
                            ? "فقط مک‌بوک (اصلی)"
                            : availableMonitors.find((m) => m.id === targetDisplay)?.name ||
                              `مانیتور ${Number(targetDisplay) + 1}`}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => handleTargetDisplayChange("all")}
                            className={`py-1.5 px-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-[11px] ${
                              targetDisplay === "all"
                                ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50 font-medium shadow-sm"
                                : "bg-black/20 text-zinc-400 border-white/5 hover:border-white/15 hover:text-white"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Layers className="w-3 h-3 text-emerald-400" />
                              <span>همه مانیتورها</span>
                            </div>
                            {targetDisplay === "all" && (
                              <Check className="w-3 h-3 text-emerald-400" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTargetDisplayChange("main")}
                            className={`py-1.5 px-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-[11px] ${
                              targetDisplay === "main"
                                ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50 font-medium shadow-sm"
                                : "bg-black/20 text-zinc-400 border-white/5 hover:border-white/15 hover:text-white"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Monitor className="w-3 h-3 text-blue-400" />
                              <span>فقط مک‌بوک</span>
                            </div>
                            {targetDisplay === "main" && (
                              <Check className="w-3 h-3 text-emerald-400" />
                            )}
                          </button>
                        </div>

                        {availableMonitors.length > 1 && (
                          <div className="pt-1.5 border-t border-white/5 space-y-1">
                            <span className="text-[10px] text-zinc-500 block">
                              مانیتورهای شناسایی‌شده سیستم:
                            </span>
                            <div className="grid grid-cols-1 gap-1">
                              {availableMonitors.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => handleTargetDisplayChange(m.id)}
                                  className={`py-1.5 px-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-[11px] ${
                                    targetDisplay === m.id
                                      ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50 font-medium"
                                      : "bg-black/20 text-zinc-400 border-white/5 hover:border-white/15 hover:text-white"
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <Monitor className="w-3 h-3 text-indigo-400 shrink-0" />
                                    <span className="truncate">
                                      {m.name} ({m.width}x{m.height})
                                    </span>
                                  </div>
                                  {targetDisplay === m.id && (
                                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded Drop Distance from Top (Notch Clearance) */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                      <div className="flex items-center justify-between text-xs text-zinc-300 mb-2">
                        <div className="flex items-center gap-1.5">
                          <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                          <span>فاصله باز شدن از بالای صفحه (زیر ناچ):</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono font-medium">
                          {expandedTopGap}px
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                        {[
                          { gap: 36, label: "کم (36px)" },
                          { gap: 48, label: "استاندارد (48px)" },
                          { gap: 64, label: "بیشتر (64px)" },
                          { gap: 80, label: "حداکثر (80px)" },
                        ].map((item) => (
                          <button
                            key={item.gap}
                            type="button"
                            onClick={() => handleExpandedTopGapChange(item.gap)}
                            className={`py-1.5 px-1 rounded-xl border transition-all cursor-pointer text-[10px] ${
                              expandedTopGap === item.gap
                                ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50 font-medium shadow-sm"
                                : "bg-black/20 text-zinc-400 border-white/5 hover:border-white/15 hover:text-white"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Super-Minimize Mode Toggle */}
                    <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-2xl">
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          حالت سوپر مینیمایز (Super Minimize)
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          کوچک‌سازی به یک بج کوچک شناور با نمایش زنده تایمر
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleSuperMinimize}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                          isSuperMinimized
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : "bg-white/10 text-zinc-300 border-white/15 hover:bg-white/15"
                        }`}
                      >
                        {isSuperMinimized ? "فعال" : "غیرفعال"}
                      </button>
                    </div>

                    {/* Developer Mode Switch - User Requested */}
                    <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-2xl">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-xs font-semibold text-white block">
                            حالت توسعه و دیباگ (Dev Mode)
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400">
                          فعال‌سازی کنسول دیباگ DevTools و ابزارهای ترافیک شبکه
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleDevMode}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                          isDevMode
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold"
                            : "bg-white/10 text-zinc-400 border-white/15 hover:bg-white/15"
                        }`}
                      >
                        {isDevMode ? "فعال" : "غیرفعال"}
                      </button>
                    </div>

                    {/* Environment switcher */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-300 mb-2">
                        <Server className="w-3.5 h-3.5 text-emerald-400" />
                        <span>سرور فعال گزارش‌گیر:</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(Object.keys(ENVIRONMENTS) as ApiEnvKey[]).map((envKey) => (
                          <button
                            key={envKey}
                            type="button"
                            onClick={() => handleEnvChange(envKey)}
                            className={`p-2 rounded-xl text-right text-xs transition-all cursor-pointer border ${
                              currentEnvKey === envKey
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-medium"
                                : "bg-black/20 text-zinc-400 border-white/5 hover:border-white/15"
                            }`}
                          >
                            <span className="block font-medium">{ENVIRONMENTS[envKey].tag}</span>
                            <span className="text-[10px] opacity-75 truncate block">
                              {ENVIRONMENTS[envKey].origin}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Utilities & Optional DevTools (Only visible when isDevMode is ON) */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenExecutionInBrowser}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-xs text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer font-medium"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>پنل وب (مرورگر)</span>
                      </button>

                      {isDevMode && (
                        <button
                          type="button"
                          onClick={handleOpenDevTools}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-xs text-amber-300 border border-amber-500/30 transition-all cursor-pointer"
                          title="باز کردن کنسول دیباگ DevTools"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          <span>کنسول دیباگ</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Footer */}
            <div className="h-[30px] px-3.5 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500 bg-black/40">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                همگام‌سازی خودکار ناچ فعال است
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleSuperMinimize}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  حالت سوپر مینیمایز
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  بستن (Esc) ↑
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default NotchBar;
