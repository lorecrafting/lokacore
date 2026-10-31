// `bin/loka dev --watch`'s API (kernel/ts/play/live.ts), proxied at /__author by vite.config.ts.
import { useEffect, useState } from 'react';

export const ask = (path: string, sent: object) =>
  fetch(`/__author/${path}`, { method: 'POST', body: JSON.stringify(sent) }).then(async (r) => ({
    ok: r.ok,
    told: (await r.json()) as unknown,
  }));

export const checkpoints = {
  list: () => fetch('/__author/checkpoints').then((r) => r.json() as Promise<string[]>),
  get: (name: string) =>
    fetch(`/__author/checkpoints/${name}`).then((r) => r.json() as Promise<{ steps: never[] }>),
  put: (name: string, steps: unknown[]) =>
    fetch(`/__author/checkpoints/${name}`, { method: 'PUT', body: JSON.stringify({ steps }) }),
};

/** The last compile's plain-words diagnostics; `undefined` until the watcher answers. */
export function useDiagnostics() {
  const [said, setSaid] = useState<string[]>();
  useEffect(() => {
    let events: EventSource;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const open = () => {
      events = new EventSource('/__author/events');
      events.onmessage = (e) => setSaid((JSON.parse(e.data) as { said: string[] }).said);
      // a 502 while the watcher restarts closes the stream for good; only a network drop retries
      events.onerror = () => {
        if (events.readyState === EventSource.CLOSED) retry = setTimeout(open, 2000);
      };
    };
    open();
    return () => {
      clearTimeout(retry);
      events.close();
    };
  }, []);
  return said;
}
