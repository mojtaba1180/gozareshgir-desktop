import React from "react";
import { Clock, CheckCircle2, AlertTriangle, Layers, User, Pin } from "lucide-react";
import { ITask } from "../types/task";
import { formatTimeSpan, toPersianDigits } from "../utils/number";

interface TaskCardProps {
  task: ITask;
  isActive?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isActive = false,
  isPinned = false,
  onTogglePin,
}) => {
  const isStopped =
    task.status === "Stopped" || String(task.status).toLowerCase() === "stopped";
  const isTodo =
    task.status === "Todo" || String(task.status).toLowerCase() === "todo";

  const priorityColors: Record<string, string> = {
    high: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };

  const priorityLabel: Record<string, string> = {
    high: "اولویت بالا",
    medium: "اولویت متوسط",
    low: "اولویت پایین",
  };

  const priorityClass =
    priorityColors[task.priority?.toLowerCase() || "medium"] ||
    priorityColors.medium;

  const priorityText =
    priorityLabel[task.priority?.toLowerCase() || "medium"] || "اولویت متوسط";

  return (
    <div
      className={`relative rounded-xl p-3 border transition-all text-right ${
        isPinned
          ? "bg-gradient-to-b from-emerald-950/40 to-zinc-900/90 border-emerald-500/50 ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-950/40"
          : isActive
          ? "bg-gradient-to-b from-emerald-950/30 to-zinc-900/90 border-emerald-500/30 shadow-md shadow-emerald-950/30"
          : isStopped
          ? "bg-zinc-900/80 border-amber-500/20"
          : "bg-zinc-900/60 border-white/5 hover:border-white/10"
      }`}
    >
      {/* Top Header: Badge, Status, Pin & Priority */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isActive && (
            <span className="flex items-center gap-1 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              در حال انجام
            </span>
          )}
          {isStopped && (
            <span className="flex items-center gap-1 text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              متوقف شده
            </span>
          )}
          {isTodo && (
            <span className="text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-full">
              برای انجام
            </span>
          )}

          {task.skillType && (
            <span className="text-[10px] bg-white/5 border border-white/10 text-zinc-400 px-1.5 py-0.5 rounded">
              {task.skillType}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Pin Button */}
          {onTogglePin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                isPinned
                  ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 font-medium shadow-sm"
                  : "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10"
              }`}
              title={
                isPinned
                  ? "حذف از ناچ (بازگشت به انتخاب خودکار)"
                  : "نمایش این تسک در ناچ بالای صفحه"
              }
            >
              <Pin
                className={`w-3 h-3 ${
                  isPinned ? "fill-emerald-400 text-emerald-400" : ""
                }`}
              />
              <span>{isPinned ? "پین‌شده در ناچ" : "پین به ناچ"}</span>
            </button>
          )}

          <span
            className={`text-[10px] border px-1.5 py-0.5 rounded-full ${priorityClass}`}
          >
            {priorityText}
          </span>
        </div>
      </div>

      {/* Task Title */}
      <h3
        className={`text-xs font-semibold leading-relaxed mb-1.5 ${
          isActive || isPinned ? "text-white" : "text-zinc-200"
        }`}
      >
        {task.title}
      </h3>

      {/* Breadcrumb Path */}
      {task.path && task.path.length > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-2 truncate">
          <Layers className="w-3 h-3 shrink-0 text-zinc-500" />
          <span className="truncate">{task.path.join(" › ")}</span>
        </div>
      )}

      {/* Progress Bar (if in progress or has progress) */}
      {task.progress && (
        <div className="space-y-1 mb-2">
          <div className="flex items-center justify-between text-[10px] text-zinc-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-zinc-500" />
              باقی‌مانده: {formatTimeSpan(task.progress.remainingTime)}
            </span>
            <span className="font-mono text-zinc-300">
              {toPersianDigits(task.progress.progressPercentage || 0)}٪
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isActive
                  ? "bg-gradient-to-l from-emerald-400 to-emerald-600"
                  : isStopped
                  ? "bg-amber-500"
                  : "bg-blue-500"
              }`}
              style={{
                width: `${Math.min(
                  100,
                  task.progress.progressPercentage || 0
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom info: Assignee & Taskino count */}
      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-zinc-400">
        <div className="flex items-center gap-1">
          {task.user && (
            <>
              <User className="w-3 h-3 text-zinc-500" />
              <span>{task.user}</span>
            </>
          )}
        </div>

        {task.taskino?.items && task.taskino.items.length > 0 && (
          <div className="flex items-center gap-1 text-zinc-400">
            <CheckCircle2 className="w-3 h-3 text-emerald-400/80" />
            <span>
              {toPersianDigits(
                task.taskino.items.filter((i) => i.isDone).length
              )}
              /
              {toPersianDigits(task.taskino.items.length)} چک‌لیست
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
