const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";

type SseHandlers<T> = {
  onMessage: (data: T) => void;
  onError?: (event: Event) => void;
  onOpen?: () => void;
};

function ensureHttps(url: string) {
  if (url.startsWith("http://")) {
    throw new Error("API 基础地址必须使用 https。");
  }
}

function buildQuery(params?: Record<string, string | number | null | undefined>) {
  if (!params) {
    return "";
  }
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && `${value}`.length > 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return entries.length ? `?${entries.join("&")}` : "";
}

function joinUrl(base: string, path: string) {
  if (base.endsWith("/")) {
    base = base.slice(0, -1);
  }
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  return `${base}${path}`;
}

export function createSseClient<T>(
  path: string,
  params: Record<string, string | number | null | undefined> | undefined,
  handlers: SseHandlers<T>,
) {
  ensureHttps(apiBase);
  const url = `${joinUrl(apiBase, path)}${buildQuery(params)}`;
  const source = new EventSource(url, { withCredentials: true });

  source.onopen = () => {
    handlers.onOpen?.();
  };

  source.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as T;
      handlers.onMessage(payload);
    } catch {
      // Ignore malformed SSE payloads
    }
  };

  source.onerror = (event) => {
    handlers.onError?.(event);
  };

  return {
    close: () => source.close(),
    raw: source,
  };
}
