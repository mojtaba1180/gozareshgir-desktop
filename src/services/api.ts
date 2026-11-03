import Cookies from "js-cookie";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { IExecuteBoardResponse, ILoginResponse } from "../types/task";
import { networkLogger, NetworkLogItem } from "./networkLogger";

export { networkLogger };
export type { NetworkLogItem };

export type ApiEnvKey = "dadmehrg" | "gozareshgir";

export interface ApiEnvironment {
  key: ApiEnvKey;
  label: string;
  tag: string;
  origin: string;
  adminOrigin: string;
  apiBase: string;
  devProxyPrefix: string;
}

export const ENVIRONMENTS: Record<ApiEnvKey, ApiEnvironment> = {
  dadmehrg: {
    key: "dadmehrg",
    label: "سرور تست و توسعه (dadmehrg)",
    tag: "تست",
    origin: "https://dadmehrg.ir",
    adminOrigin: "https://admin.dadmehrg.ir",
    apiBase: "https://dadmehrg.ir/api/",
    devProxyPrefix: "/proxy-dadmehrg",
  },
  gozareshgir: {
    key: "gozareshgir",
    label: "سرور اصلی و پروداکشن (gozareshgir)",
    tag: "اصلی",
    origin: "https://gozareshgir.ir",
    adminOrigin: "https://admin.gozareshgir.ir",
    apiBase: "https://gozareshgir.ir/api/",
    devProxyPrefix: "/proxy-gozareshgir",
  },
};

const ENV_KEY = "gozareshgir_active_environment";
const RAW_COOKIE_KEY = "gozareshgir_raw_cookie";

function parseJwt(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

class ApiService {
  private currentEnv: ApiEnvironment;

  constructor() {
    const savedEnv = (localStorage.getItem(ENV_KEY) as ApiEnvKey) || "dadmehrg";
    this.currentEnv = ENVIRONMENTS[savedEnv] || ENVIRONMENTS.dadmehrg;
  }

  public getEnvironment(): ApiEnvironment {
    return this.currentEnv;
  }

  public setEnvironment(envKey: ApiEnvKey) {
    if (!ENVIRONMENTS[envKey]) return;
    this.currentEnv = ENVIRONMENTS[envKey];
    localStorage.setItem(ENV_KEY, envKey);
    console.log(`[API Environment Switched] ${envKey}: ${this.currentEnv.apiBase}`);
    window.dispatchEvent(new Event("storage"));
  }

  // --- Cookie and Token Getters ---
  public getAccessToken(): string | undefined {
    return Cookies.get("accessToken") || localStorage.getItem("accessToken") || undefined;
  }

  public getRefreshToken(): string | undefined {
    return Cookies.get("refreshToken") || localStorage.getItem("refreshToken") || undefined;
  }

  public getAccountId(): string | undefined {
    return Cookies.get("accountId") || localStorage.getItem("accountId") || undefined;
  }

  public getUserFullName(): string | undefined {
    return Cookies.get("fullName") || localStorage.getItem("fullName") || undefined;
  }

  public getAspNetCoreCookie(): string | undefined {
    return (
      Cookies.get(".AspNetCore.Cookies") ||
      localStorage.getItem(".AspNetCore.Cookies") ||
      undefined
    );
  }

  public getRawCookie(): string | undefined {
    return localStorage.getItem(RAW_COOKIE_KEY) || undefined;
  }

  public isAuthenticated(): boolean {
    return !!this.getAccessToken() || !!this.getAspNetCoreCookie() || !!this.getRawCookie();
  }

  // --- Request Headers exactly matching browser request to https://gozareshgir.ir/api/ProgramManager/ExecuteBoard ---
  private buildHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const originUrl = this.currentEnv.adminOrigin;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json, text/plain, */*",
      "X-Client-Name": "site",
      "Origin": originUrl,
      "Referer": `${originUrl}/`,
      ...customHeaders,
    };

    const accessToken = this.getAccessToken();
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    // Prefer full raw cookie string if user pasted multiple cookies, otherwise fallback to .AspNetCore.Cookies
    const rawCookie = this.getRawCookie();
    if (rawCookie) {
      headers["Cookie"] = rawCookie;
    } else {
      const aspNetCookie = this.getAspNetCoreCookie();
      if (aspNetCookie) {
        headers["Cookie"] = aspNetCookie.includes(".AspNetCore.Cookies")
          ? aspNetCookie
          : `.AspNetCore.Cookies=${aspNetCookie}`;
      }
    }

    return headers;
  }

  /**
   * Resolves target URL:
   * In Dev mode: converts https://gozareshgir.ir/... to /proxy-gozareshgir/...
   * so requests go through Vite Dev Proxy and appear in DevTools Network tab!
   */
  private resolveRequestUrl(rawUrl: string): { requestUrl: string; isProxied: boolean } {
    if (import.meta.env.DEV) {
      if (rawUrl.startsWith(this.currentEnv.origin)) {
        const pathPart = rawUrl.substring(this.currentEnv.origin.length);
        return {
          requestUrl: `${this.currentEnv.devProxyPrefix}${pathPart}`,
          isProxied: true,
        };
      }
    }
    return { requestUrl: rawUrl, isProxied: false };
  }

  /**
   * Unified HTTP Request with:
   * 1. DevTools Network Tab support (via WebKit window.fetch & Vite dev proxy)
   * 2. Native Rust HTTP fallback (via tauriFetch)
   * 3. In-App Network Inspector Logging
   * 4. Beautiful DevTools Console grouping
   */
  public async request<T>(
    endpoint: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE";
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    // Build full absolute URL
    let fullUrl = endpoint.startsWith("http")
      ? endpoint
      : `${this.currentEnv.apiBase}${endpoint.replace(/^\//, "")}`;

    const method = options.method || "GET";
    const headers = this.buildHeaders(options.headers);
    const startTime = Date.now();

    // 1. Log request to In-App Network Inspector
    const logId = networkLogger.startRequest({
      method,
      url: fullUrl,
      headers,
      body: options.body,
    });

    // 2. Prepare URL for execution
    const { requestUrl, isProxied } = this.resolveRequestUrl(fullUrl);

    // 3. DevTools Console Group
    console.groupCollapsed(
      `%c[HTTP ${method}] ${fullUrl} %c(${isProxied ? "Dev Proxy / Network Tab" : "Native Tauri"})`,
      "color: #38bdf8; font-weight: bold",
      "color: #94a3b8; font-size: 10px"
    );
    console.log("Request URL:", fullUrl);
    console.log("Resolved URL:", requestUrl);
    console.log("Headers:", headers);
    if (options.body) console.log("Payload:", options.body);

    let response: any = null;

    try {
      // First try standard window.fetch if in dev (so it appears in Network tab)
      if (isProxied) {
        try {
          response = await window.fetch(requestUrl, {
            method,
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
          });
        } catch (fetchErr) {
          console.warn("[window.fetch failed, falling back to native tauriFetch]:", fetchErr);
        }
      }

      // If not proxied or window.fetch failed, use native Tauri HTTP plugin
      if (!response) {
        response = await tauriFetch(fullUrl, {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          credentials: "include",
        });
      }

      const durationMs = Date.now() - startTime;
      const status = response.status;
      const statusText = response.statusText || "";

      // Extract response headers
      const resHeaders: Record<string, string> = {};
      response.headers.forEach((v: string, k: string) => {
        resHeaders[k] = v;
      });

      // Extract Set-Cookie (.AspNetCore.Cookies)
      const setCookie = response.headers.get("set-cookie") || resHeaders["set-cookie"];
      if (setCookie) {
        console.log(`[Set-Cookie Detected]:`, setCookie);
        const match = setCookie.match(/\.AspNetCore\.Cookies=([^;]+)/);
        if (match && match[1]) {
          const cookieVal = match[1];
          Cookies.set(".AspNetCore.Cookies", cookieVal, {
            sameSite: "none",
            secure: true,
          });
          localStorage.setItem(".AspNetCore.Cookies", cookieVal);
          console.log(`[Stored .AspNetCore.Cookies successfully]`);
        }
      }

      // Parse response body
      let data: any = null;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("json")) {
        try {
          data = await response.json();
        } catch {
          data = null;
        }
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      // Finish log in In-App Network Inspector
      networkLogger.finishRequest(logId, {
        status,
        statusText,
        responseHeaders: resHeaders,
        responseBody: data,
        durationMs,
      });

      console.log(`Response Status: %c${status} ${statusText}`, status < 300 ? "color: #10b981; font-weight: bold" : "color: #ef4444; font-weight: bold");
      console.log("Response Body:", data);
      console.groupEnd();

      if (!response.ok) {
        const errorMessage =
          (data && (data.message || data.errorMessage)) ||
          (Array.isArray(data?.errors) ? data.errors.join(", ") : null) ||
          `خطای سرور (${status})`;
        const err = new Error(errorMessage);
        (err as any).status = status;
        (err as any).data = data;
        (err as any).url = fullUrl;
        throw err;
      }

      return data as T;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      networkLogger.finishRequest(logId, {
        status: err.status || 0,
        statusText: err.message,
        durationMs,
        error: err.message,
      });
      console.error(`[API Call Failed] ${fullUrl}:`, err);
      console.groupEnd();
      throw err;
    }
  }

  /**
   * Universal Auth Parser:
   * Handles:
   * 1. Full DevTools Network tab header dump (containing "Request URL... cookie\n... origin...")
   * 2. Full cookie string (".AspNetCore.Antiforgery...; .AspNetCore.Cookies=...")
   * 3. Specific ".AspNetCore.Cookies=CfDJ8..."
   * 4. Raw cookie value ("CfDJ8...")
   * 5. JWT Token ("eyJ...") or Bearer Token ("Bearer eyJ...")
   * 6. JSON dump
   */
  public async applyToken(rawInput: string): Promise<{ success: boolean; fullName?: string; message?: string }> {
    let input = rawInput.trim();
    if (!input) {
      throw new Error("لطفاً توکن یا کوکی معتبر وارد کنید.");
    }

    // 1. If user pasted a multi-line DevTools request dump, extract the cookie line
    if (input.includes("Request URL") || input.includes(":path") || input.toLowerCase().includes("cookie")) {
      const lines = input.split(/[\r\n]+/).map((l) => l.trim());
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.toLowerCase() === "cookie" && i + 1 < lines.length) {
          input = lines[i + 1];
          break;
        }
        if (line.toLowerCase().startsWith("cookie:")) {
          input = line.substring(7).trim();
          break;
        }
      }
    }

    let tokenToSet: string | undefined;
    let refreshTokenToSet: string | undefined;
    let cookieToSet: string | undefined;
    let fullCookieString: string | undefined;
    let accountIdToSet: string | undefined;
    let fullNameToSet: string | undefined;

    // 2. Try parsing JSON (e.g. from localStorage/sessionStorage dump)
    if (input.startsWith("{") && input.endsWith("}")) {
      try {
        const parsed = JSON.parse(input);
        tokenToSet = parsed.accessToken || parsed.jwtAccessToken || parsed.authToken || parsed.token;
        refreshTokenToSet = parsed.refreshToken || parsed.jwtRefreshToken;
        cookieToSet = parsed[".AspNetCore.Cookies"] || parsed.cookie;
        accountIdToSet = parsed.accountId ? String(parsed.accountId) : undefined;
        fullNameToSet = parsed.accountFullName || parsed.fullName || parsed.name;
      } catch {
        // Not JSON
      }
    }

    // 3. Try parsing Cookie header string (contains .AspNetCore.Cookies or =)
    if (!tokenToSet && (input.includes(".AspNetCore.Cookies") || input.includes(";"))) {
      fullCookieString = input;
      const parts = input.split(";").map((p) => p.trim());
      for (const part of parts) {
        const [k, ...vParts] = part.split("=");
        const v = vParts.join("=");
        if (k === ".AspNetCore.Cookies") cookieToSet = v;
        if (k === "accessToken" || k === "authToken") tokenToSet = v;
        if (k === "refreshToken") refreshTokenToSet = v;
        if (k === "accountId") accountIdToSet = v;
        if (k === "fullName") fullNameToSet = decodeURIComponent(v);
      }
    }

    // 4. Raw Bearer or JWT or raw CfDJ8 cookie value
    if (!tokenToSet && !cookieToSet) {
      if (input.toLowerCase().startsWith("bearer ")) {
        tokenToSet = input.substring(7).trim();
      } else if (input.includes(".")) {
        tokenToSet = input;
      } else if (input.startsWith("CfDJ8")) {
        cookieToSet = input;
        fullCookieString = `.AspNetCore.Cookies=${input}`;
      } else {
        tokenToSet = input;
      }
    }

    // Decode JWT payload if available
    if (tokenToSet && tokenToSet.includes(".")) {
      const payload = parseJwt(tokenToSet);
      if (payload) {
        if (!fullNameToSet) {
          fullNameToSet =
            payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] ||
            payload.name ||
            payload.unique_name ||
            payload.fullname ||
            payload.FullName;
        }
        if (!accountIdToSet) {
          accountIdToSet =
            payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ||
            payload.nameid ||
            payload.id ||
            payload.AccountId;
        }
      }
    }

    // Save tokens and cookies
    if (tokenToSet) {
      Cookies.set("authToken", tokenToSet);
      Cookies.set("accessToken", tokenToSet);
      localStorage.setItem("accessToken", tokenToSet);
    }

    if (refreshTokenToSet) {
      Cookies.set("refreshToken", refreshTokenToSet);
      localStorage.setItem("refreshToken", refreshTokenToSet);
    }

    if (cookieToSet) {
      Cookies.set(".AspNetCore.Cookies", cookieToSet, {
        sameSite: "none",
        secure: true,
      });
      localStorage.setItem(".AspNetCore.Cookies", cookieToSet);
    }

    if (fullCookieString) {
      localStorage.setItem(RAW_COOKIE_KEY, fullCookieString);
    }

    if (accountIdToSet) {
      Cookies.set("accountId", String(accountIdToSet));
      localStorage.setItem("accountId", String(accountIdToSet));
    }

    if (fullNameToSet) {
      Cookies.set("fullName", fullNameToSet);
      localStorage.setItem("fullName", fullNameToSet);
    }

    // Test verify authentication immediately by calling ExecuteBoard!
    let taskCount = 0;
    try {
      console.log(`[Auth Verification] Calling ExecuteBoard...`);
      const boardRes = await this.getExecuteBoard();
      const items =
        (Array.isArray(boardRes?.data?.items) && boardRes.data.items) ||
        (Array.isArray(boardRes?.data) && boardRes.data) ||
        (Array.isArray(boardRes?.items) && boardRes.items) ||
        [];
      taskCount = items.length;
      console.log(`[Auth Verified Successfully] Loaded ${taskCount} tasks!`);
    } catch (boardErr: any) {
      console.warn("[ExecuteBoard verification error]:", boardErr);
      // If error is 401/403, throw to user
      if (boardErr.status === 401 || boardErr.status === 403) {
        throw new Error("کوکی یا توکن وارد شده نامعتبر یا منقضی شده است (۴۰۱ Unauthorized).");
      }
    }

    // Optionally try fetching profile for user fullname
    try {
      const profile = await this.getProfile();
      if (profile) {
        if (profile.fullname) {
          fullNameToSet = profile.fullname;
          Cookies.set("fullName", profile.fullname);
          localStorage.setItem("fullName", profile.fullname);
        }
      }
    } catch {
      // Profile fetch is optional
    }

    window.dispatchEvent(new Event("storage"));

    return {
      success: true,
      fullName: fullNameToSet || "کاربر گزارش‌گیر",
      message: `احراز هویت با موفقیت انجام شد (${taskCount} تسک یافت شد)`,
    };
  }

  /**
   * Get Admin user profile
   * GET ${apiBase}Admin/Login/Profile
   */
  public async getProfile(): Promise<any> {
    return this.request<any>("Admin/Login/Profile", {
      method: "GET",
    });
  }

  /**
   * Optional Credential Login
   */
  public async login(username: string, password: string): Promise<ILoginResponse> {
    const payload = { username, password };
    const primaryUrl = `${this.currentEnv.apiBase}login`;
    const fallbackUrl = `${this.currentEnv.origin}/login`;

    let data: ILoginResponse | null = null;
    try {
      data = await this.request<ILoginResponse>(primaryUrl, {
        method: "POST",
        body: payload,
      });
    } catch (err: any) {
      if (err.status === 404) {
        data = await this.request<ILoginResponse>(fallbackUrl, {
          method: "POST",
          body: payload,
        });
      } else {
        throw err;
      }
    }

    if (data) {
      if (data.jwtAccessToken) {
        Cookies.set("authToken", data.jwtAccessToken);
        Cookies.set("accessToken", data.jwtAccessToken);
        localStorage.setItem("accessToken", data.jwtAccessToken);
      }
      if (data.jwtRefreshToken) {
        Cookies.set("refreshToken", data.jwtRefreshToken);
        localStorage.setItem("refreshToken", data.jwtRefreshToken);
      }
      if (data.accountId) {
        Cookies.set("accountId", String(data.accountId));
        localStorage.setItem("accountId", String(data.accountId));
      }
      if (data.accountFullName) {
        Cookies.set("fullName", data.accountFullName);
        localStorage.setItem("fullName", data.accountFullName);
      }
      window.dispatchEvent(new Event("storage"));
    }
    return data!;
  }

  public logout() {
    Cookies.remove("authToken");
    Cookies.remove("accessToken");
    Cookies.remove("refreshToken");
    Cookies.remove("accountId");
    Cookies.remove("fullName");
    Cookies.remove(".AspNetCore.Cookies");

    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("accountId");
    localStorage.removeItem("fullName");
    localStorage.removeItem(".AspNetCore.Cookies");
    localStorage.removeItem(RAW_COOKIE_KEY);

    window.dispatchEvent(new Event("storage"));
  }

  /**
   * Get ExecuteBoard tasks:
   * GET ${apiBase}ProgramManager/ExecuteBoard
   */
  public async getExecuteBoard(): Promise<IExecuteBoardResponse> {
    return this.request<IExecuteBoardResponse>("ProgramManager/ExecuteBoard", {
      method: "GET",
    });
  }
}

export const api = new ApiService();
