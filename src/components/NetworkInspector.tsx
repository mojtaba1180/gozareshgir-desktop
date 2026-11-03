import React, { useEffect, useState } from "react";
import {
  networkLogger,
  NetworkLogItem,
} from "../services/networkLogger";
import {
  Activity,
  X,
  Copy,
  Check,
  Trash2,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
} from "lucide-react";

interface NetworkInspectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NetworkInspector: React.FC<NetworkInspectorProps> = ({
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<NetworkLogItem[]>(networkLogger.getLogs());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "errors" | "success">("all");

  useEffect(() => {
    return networkLogger.subscribe((updated: NetworkLogItem[]) => {
      setLogs(updated);
      if (updated.length > 0 && !selectedId) {
        setSelectedId(updated[0].id);
      }
    });
  }, [selectedId]);

  useEffect(() => {
    if (logs.length > 0 && !selectedId) {
      setSelectedId(logs[0].id);
    }
  }, [logs, selectedId]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((item) => {
    if (filter === "errors") return item.status && item.status >= 400;
    if (filter === "success") return item.status && item.status < 400;
    return true;
  });

  const selectedLog = logs.find((l) => l.id === selectedId) || logs[0];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const getStatusBadge = (status?: number) => {
    if (!status) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono">
          در انتظار...
        </span>
      );
    }
    if (status >= 200 && status < 300) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-mono font-medium">
          {status} OK
        </span>
      );
    }
    if (status === 404) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 font-mono font-bold">
          404 Not Found
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 font-mono font-medium">
        {status} Error
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-sans text-right animate-in fade-in duration-150">
      <div className="w-full max-w-4xl h-[560px] bg-zinc-950/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>بررسی زنده ترافیک شبکه</span>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/10 text-zinc-300 font-mono">
                  {logs.length} ریکوئست
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                مشاهده کامل هدرها، پارامترها و پاسخ‌های سرور
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div className="flex bg-zinc-900 border border-white/10 rounded-lg p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-2 py-1 rounded transition-colors ${
                  filter === "all"
                    ? "bg-white/15 text-white font-medium"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                همه ({logs.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("errors")}
                className={`px-2 py-1 rounded transition-colors ${
                  filter === "errors"
                    ? "bg-rose-500/20 text-rose-300 font-medium"
                    : "text-zinc-400 hover:text-rose-400"
                }`}
              >
                خطاها ({logs.filter((l) => l.status && l.status >= 400).length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => networkLogger.clear()}
              title="پاکسازی لاگ‌ها"
              className="p-1.5 rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body: Master / Detail */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Request List */}
          <div className="w-80 border-l border-white/10 flex flex-col bg-zinc-900/30 overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                هنوز هیچ درخواستی ثبت نشده است
              </div>
            ) : (
              filteredLogs.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full p-3 text-right border-b border-white/5 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-sky-500/10 border-l-2 border-l-sky-500"
                        : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono font-bold text-[10px] px-1.5 py-0.5 rounded ${
                            item.method === "POST"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-blue-500/15 text-blue-300"
                          }`}
                        >
                          {item.method}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500" dir="ltr">
                        {item.timestamp}
                      </span>
                    </div>

                    <div
                      className="text-xs font-mono text-zinc-300 truncate"
                      dir="ltr"
                      title={item.url}
                    >
                      {item.url.replace(/^https?:\/\/[^/]+/, "")}
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500">
                      <span>{item.url.includes("gozareshgir.ir") ? "اصلی" : "تست"}</span>
                      {item.durationMs !== undefined && (
                        <span className="font-mono">{item.durationMs}ms</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: Request Details */}
          <div className="flex-1 flex flex-col overflow-y-auto p-5 bg-zinc-950/60 space-y-4">
            {selectedLog ? (
              <>
                {/* Status Bar */}
                <div className="flex items-center justify-between bg-zinc-900/80 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400">
                      {selectedLog.method}
                    </span>
                    <span className="font-mono text-xs text-white" dir="ltr">
                      {selectedLog.url}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedLog.status)}
                    {selectedLog.durationMs !== undefined && (
                      <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {selectedLog.durationMs}ms
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedLog.url, "url")}
                      className="p-1 rounded text-zinc-400 hover:text-white"
                      title="کپی آدرس"
                    >
                      {copiedKey === "url" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Request Payload */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                      بدنه ارسالی (Request Payload)
                    </span>
                    {selectedLog.requestBody && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            JSON.stringify(selectedLog.requestBody, null, 2),
                            "req"
                          )
                        }
                        className="text-[10px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                      >
                        {copiedKey === "req" ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        کپی JSON
                      </button>
                    )}
                  </div>
                  <pre
                    className="p-3 rounded-xl bg-zinc-900/90 border border-white/5 text-[11px] font-mono text-amber-300/90 overflow-x-auto max-h-40"
                    dir="ltr"
                  >
                    {selectedLog.requestBody
                      ? JSON.stringify(selectedLog.requestBody, null, 2)
                      : "بدون بدنه ارسالی (Empty Body)"}
                  </pre>
                </div>

                {/* Response Body */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                      پاسخ سرور (Response Body)
                    </span>
                    {selectedLog.responseBody && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            typeof selectedLog.responseBody === "string"
                              ? selectedLog.responseBody
                              : JSON.stringify(selectedLog.responseBody, null, 2),
                            "res"
                          )
                        }
                        className="text-[10px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                      >
                        {copiedKey === "res" ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        کپی پاسخ
                      </button>
                    )}
                  </div>
                  <pre
                    className="p-3 rounded-xl bg-zinc-900/90 border border-white/5 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-52"
                    dir="ltr"
                  >
                    {selectedLog.responseBody
                      ? typeof selectedLog.responseBody === "string"
                        ? selectedLog.responseBody
                        : JSON.stringify(selectedLog.responseBody, null, 2)
                      : selectedLog.error || "بدون محتوا (Empty Response)"}
                  </pre>
                </div>

                {/* Request Headers */}
                <div>
                  <span className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    هدرهای درخواست (Request Headers)
                  </span>
                  <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-white/5 text-[11px] font-mono space-y-1 text-zinc-400" dir="ltr">
                    {Object.entries(selectedLog.requestHeaders).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-sky-400/80">{k}:</span>
                        <span className="text-zinc-300 truncate">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Response Headers */}
                {selectedLog.responseHeaders && (
                  <div>
                    <span className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      هدرهای پاسخ (Response Headers)
                    </span>
                    <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-white/5 text-[11px] font-mono space-y-1 text-zinc-400" dir="ltr">
                      {Object.entries(selectedLog.responseHeaders).map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="text-emerald-400/80">{k}:</span>
                          <span className="text-zinc-300 truncate">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                یک درخواست را از لیست سمت چپ انتخاب کنید
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
