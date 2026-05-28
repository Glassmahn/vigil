export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };
  const proxyPath = `/api/agent${path}`;
  return fetch(proxyPath, { ...options, headers });
}

export function apiEventSource(path: string): EventSource {
  const proxyPath = `/api/agent${path}`;
  const es = new EventSource(proxyPath);
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  es.addEventListener("error", () => {
    if (es.readyState === EventSource.CLOSED) {
      es.close();
    }
  });

  const originalClose = es.close.bind(es);
  es.close = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    originalClose();
  };

  return es;
}
