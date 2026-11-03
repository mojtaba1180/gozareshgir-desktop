import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  RefreshCw,
  LogOut,
  ChevronUp,
  ChevronDown,
  CheckCircle,
  PauseCircle,
  ListTodo,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { ITask } from "../types/task";
import { TaskCard } from "./TaskCard";
import { formatTimeSpan, toPersianDigits } from "../utils/number";

interface DynamicIslandProps {
  activeTask: ITask | null;
  stoppedTasks: ITask[];
  todoTasks: ITask[];
  loading: boolean;
  userFullName?: string;
  onRefresh: () => void;
  onLogout: () => void;
}

export const DynamicIsland: React.FC<DynamicIslandProps> = ({
  activeTask,
  stoppedTasks,
  todoTasks,
  loading,
  userFullName,
  onRefresh,
  onLogout,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"inProgress" | "stopped" | "todo">(
    "inProgress"
  );

  // Resize window via Tauri IPC command whenever expansion changes
  useEffect(() => {
    try {
      if (isExpanded) {
        invoke("resize_notch", { width: 440, height: 520 });
      } else {
        invoke("resize_notch", { width: 380, height: 44 });
      }
    } catch (e) {
      console.warn("Tauri invoke not available:", e);
    }
  }, [isExpanded]);

  // If user opens and there is no active task, auto-switch to stopped or todo
  useEffect(() => {
    if (!activeTask && stoppedTasks.length > 0) {
      setActiveTab("stopped");
    } else if (!activeTask && todoTasks.length > 0) {
      setActiveTab("todo");
    } else {
      setActiveTab("inProgress");
    }
  }, [activeTask, stoppedTasks.length, todoTasks.length]);

  return (
    <div className="w-full flex justify-center select-none font-sans" dir="rtl">
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className={`w-full bg-black/95 backdrop-blur-2xl border-x border-b border-white/10 shadow-2xl text-white overflow-hidden ${
          isExpanded ? "rounded-b-3xl" : "rounded-b-2xl"
        }`}
      >
        {/* COLLAPSED BAR (Always visible at the top) */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-11 px-3.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors"
        >
          {/* Right Section: Status Indicator & Active Task Title */}
          <div className="flex items-center gap-2 overflow-hidden max-w-[240px]">
            {activeTask ? (
              <>
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-xs font-medium text-white truncate">
                  {activeTask.title}
                </span>
              </>
            ) : stoppedTasks.length > 0 ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-xs text-amber-200/90 truncate">
                  {toPersianDigits(stoppedTasks.length)} تسک متوقف شده
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-zinc-500 shrink-0" />
                <span className="text-xs text-zinc-400 truncate">
                  بدون تسک فعال
                </span>
              </>
            )}
          </div>

          {/* Left Section: Time Remaining & Collapse/Expand Icon */}
          <div className="flex items-center gap-2 shrink-0">
            {activeTask?.progress?.remainingTime && (
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-mono text-[11px] text-emerald-400">
                <Clock className="w-3 h-3 text-emerald-400/80" />
                <span>{formatTimeSpan(activeTask.progress.remainingTime)}</span>
              </div>
            )}

            <div className="text-zinc-400 hover:text-white transition-colors">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </div>
        </div>

        {/* EXPANDED CONTENT AREA */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="p-3.5 pt-0 border-t border-white/5"
            >
              {/* Header Bar */}
              <div className="flex items-center justify-between py-2 border-b border-white/10 mb-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold">
                    گ
                  </div>
                  <div>
                    <span className="font-semibold text-white">گزارش‌گیر</span>
                    {userFullName && (
                      <span className="text-[10px] text-zinc-400 mr-2">
                        ({userFullName})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefresh();
                    }}
                    title="به‌روزرسانی تسک‌ها"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`}
                    />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLogout();
                    }}
                    title="خروج از حساب"
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Status Tabs */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-900/90 rounded-xl border border-white/5 mb-3 text-[11px]">
                <button
                  onClick={() => setActiveTab("inProgress")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === "inProgress"
                      ? "bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <CheckCircle className="w-3 h-3" />
                  <span>در حال انجام</span>
                  {activeTask && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("stopped")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === "stopped"
                      ? "bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <PauseCircle className="w-3 h-3" />
                  <span>متوقف شده</span>
                  {stoppedTasks.length > 0 && (
                    <span className="text-[9px] bg-amber-500/30 text-amber-300 px-1 rounded-full">
                      {toPersianDigits(stoppedTasks.length)}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("todo")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === "todo"
                      ? "bg-blue-500/20 text-blue-300 font-medium border border-blue-500/30"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <ListTodo className="w-3 h-3" />
                  <span>برای انجام</span>
                  {todoTasks.length > 0 && (
                    <span className="text-[9px] bg-blue-500/30 text-blue-300 px-1 rounded-full">
                      {toPersianDigits(todoTasks.length)}
                    </span>
                  )}
                </button>
              </div>

              {/* Tasks List Content */}
              <div className="max-h-[320px] overflow-y-auto space-y-2 pr-0.5">
                {activeTab === "inProgress" && (
                  <div>
                    {activeTask ? (
                      <TaskCard task={activeTask} isActive={true} />
                    ) : (
                      <div className="text-center py-8 text-zinc-500 text-xs">
                        در حال حاضر هیچ تسکی در وضعیت «در حال انجام» نیست.
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "stopped" && (
                  <div className="space-y-2">
                    {stoppedTasks.length > 0 ? (
                      stoppedTasks.map((t) => <TaskCard key={t.id} task={t} />)
                    ) : (
                      <div className="text-center py-8 text-zinc-500 text-xs">
                        هیچ تسک متوقف‌شده‌ای وجود ندارد.
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "todo" && (
                  <div className="space-y-2">
                    {todoTasks.length > 0 ? (
                      todoTasks.map((t) => <TaskCard key={t.id} task={t} />)
                    ) : (
                      <div className="text-center py-8 text-zinc-500 text-xs">
                        تسک در صف برای انجام موجود نیست.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer status */}
              <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-white/5 text-[10px] text-zinc-500">
                <span>همگام‌سازی خودکار هر ۱۰ ثانیه</span>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  بستن پنل ↑
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
