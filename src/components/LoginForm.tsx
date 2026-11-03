import React, { useState, useEffect } from "react";
import {
  KeyRound,
  ClipboardPaste,
  CheckCircle,
  AlertCircle,
  Loader2,
  Server,
  Activity,
  ShieldCheck,
  Info,
} from "lucide-react";
import { api, ApiEnvKey } from "../services/api";
import { NetworkInspector } from "./NetworkInspector";
import { networkLogger } from "../services/networkLogger";

interface LoginFormProps {
  onSuccess: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showNetworkInspector, setShowNetworkInspector] = useState(false);
  const [requestCount, setRequestCount] = useState(networkLogger.getLogs().length);
  const [currentEnvKey, setCurrentEnvKey] = useState<ApiEnvKey>(
    api.getEnvironment().key
  );

  useEffect(() => {
    return networkLogger.subscribe((logs) => setRequestCount(logs.length));
  }, []);

  const handleEnvSwitch = (key: ApiEnvKey) => {
    setCurrentEnvKey(key);
    api.setEnvironment(key);
    setError(null);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTokenInput(text.trim());
        setError(null);
      }
    } catch {
      setError("دسترسی به کلیپ‌بورد امکان‌پذیر نشد. لطفاً توکن را دستی Paste کنید.");
    }
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      setError("لطفاً توکن دسترسی را وارد نمایید.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.applyToken(trimmed);
      setSuccessMsg(`خوش آمدید ${res.fullName}! در حال بارگذاری تسک‌ها...`);
      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (err: any) {
      console.error("Token apply failed:", err);
      setError(err.message || "توکن واردشده نامعتبر یا منقضی شده است.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="w-full max-w-md mx-auto p-6 text-right font-sans text-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-black font-bold text-base shadow-lg shadow-emerald-950/40">
              <KeyRound className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">ورود به گزارش‌گیر</h2>
              <p className="text-xs text-zinc-400">ورود سریع با توکن احراز هویت</p>
            </div>
          </div>

          {/* Environment Switcher */}
          <div className="flex items-center bg-zinc-950/90 border border-white/10 rounded-xl p-1 text-[11px]">
            <button
              type="button"
              onClick={() => handleEnvSwitch("dadmehrg")}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                currentEnvKey === "dadmehrg"
                  ? "bg-emerald-500/25 text-emerald-300 font-medium shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              محیط تست
            </button>
            <button
              type="button"
              onClick={() => handleEnvSwitch("gozareshgir")}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                currentEnvKey === "gozareshgir"
                  ? "bg-teal-500/25 text-teal-300 font-medium shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              محیط اصلی
            </button>
          </div>
        </div>

        {/* Server & API Info */}
        <div className="mb-4 text-xs text-zinc-400 flex items-center justify-between bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
          <div className="flex items-center gap-1.5 truncate">
            <Server className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>آدرس API: </span>
            <span className="font-mono text-emerald-400 truncate text-[11px]" dir="ltr">
              {api.getEnvironment().apiBase}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowNetworkInspector(true)}
            className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-[10px] cursor-pointer transition-colors border border-sky-500/30 font-sans"
          >
            <Activity className="w-3 h-3 text-sky-400" />
            <span>لاگ ({requestCount})</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 flex items-center justify-between rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowNetworkInspector(true)}
              className="text-[10px] underline hover:text-rose-200 cursor-pointer shrink-0 mr-2"
            >
              بررسی لاگ
            </button>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3 text-xs text-emerald-300">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Token Input Form */}
        <form onSubmit={handleTokenSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>توکن دسترسی (Bearer Token یا Cookie):</span>
              </label>
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer font-medium bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 transition-all hover:bg-emerald-500/20"
              >
                <ClipboardPaste className="w-3 h-3" />
                <span>جای‌گذاری از کلیپ‌بورد</span>
              </button>
            </div>
            <textarea
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="توکن JWT یا رشته کوکی خود را اینجا قرار دهید..."
              rows={5}
              dir="ltr"
              autoFocus
              className="w-full rounded-2xl bg-zinc-950/90 border border-white/10 p-3.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 font-mono transition-all text-left resize-none shadow-inner"
            />
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-zinc-400">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              می‌توانید توکن accessToken مستقیم، رشته کامل هدر Authorization یا کل کوکی‌های مرورگر را در این فیلد قرار دهید؛ سیستم خودکار داده‌ها را استخراج و ذخیره خواهد کرد.
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white py-3 text-xs font-semibold shadow-lg shadow-emerald-950/50 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>تایید توکن و بارگذاری تسک‌ها</span>
              </>
            )}
          </button>
        </form>
      </div>

      <NetworkInspector
        isOpen={showNetworkInspector}
        onClose={() => setShowNetworkInspector(false)}
      />
    </>
  );
};
