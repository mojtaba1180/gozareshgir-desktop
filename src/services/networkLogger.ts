export interface NetworkLogItem {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody?: any;
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  durationMs?: number;
  error?: string;
}

type Listener = (logs: NetworkLogItem[]) => void;

class NetworkLoggerService {
  private logs: NetworkLogItem[] = [];
  private listeners: Set<Listener> = new Set();
  private maxLogs = 50;

  public getLogs(): NetworkLogItem[] {
    return this.logs;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l([...this.logs]));
  }

  public startRequest(item: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
  }): string {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logItem: NetworkLogItem = {
      id,
      timestamp: new Date().toLocaleTimeString("fa-IR"),
      method: item.method,
      url: item.url,
      requestHeaders: item.headers,
      requestBody: item.body,
    };

    this.logs = [logItem, ...this.logs].slice(0, this.maxLogs);
    this.notify();
    return id;
  }

  public finishRequest(
    id: string,
    result: {
      status: number;
      statusText?: string;
      responseHeaders?: Record<string, string>;
      responseBody?: any;
      durationMs?: number;
      error?: string;
    }
  ) {
    const target = this.logs.find((l) => l.id === id);
    if (target) {
      target.status = result.status;
      target.statusText = result.statusText;
      target.responseHeaders = result.responseHeaders;
      target.responseBody = result.responseBody;
      target.durationMs = result.durationMs;
      target.error = result.error;
      this.notify();
    }
  }

  public clear() {
    this.logs = [];
    this.notify();
  }
}

export const networkLogger = new NetworkLoggerService();
