// Fast loop client (docs/system/cartridge.md#author-preview): the text overlay and diagnostics
// `bin/loka dev --watch` pushes over `/__author/events` (kernel/ts/play/live.ts). The overlay is
// words over the artifact the page runs, in memory only; a Book text lookup reads it first.
export const overlay: Record<string, string> = {};
export type Message = {
  text: Record<string, string>;
  said: string[];
  unconfirmed?: { key: string }[];
  changed?: { file: string }[];
};

/** Follows the stream until the returned function is called; `onMessage` gets each message. */
export function listen(onMessage: (message: Message) => void) {
  let events: EventSource;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const open = () => {
    events = new EventSource('/__author/events');
    events.onmessage = (e) => {
      const message = JSON.parse(e.data) as Message;
      for (const key of Object.keys(overlay)) delete overlay[key];
      Object.assign(overlay, message.text);
      onMessage(message);
    };
    // a 502 while the watcher restarts closes the stream for good, so reopen by hand; the browser
    // retries a network drop itself
    events.onerror = () => {
      if (events.readyState === EventSource.CLOSED) retry = setTimeout(open, 2000);
    };
  };
  open();
  return () => (clearTimeout(retry), events.close());
}
