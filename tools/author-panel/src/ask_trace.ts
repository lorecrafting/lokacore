// A Book that stops answering must not hang Why: give up after a few seconds, in plain words.
// A reply that comes after its timeout finds no waiter and is dropped.
export function askTrace(
  waiting: Map<number, (rows: string[]) => void>,
  send: (id: number) => void,
  id: number,
  ms = 5000,
) {
  return new Promise<string[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      reject(new Error('The Book did not answer. Reload the Book, then ask again.'));
    }, ms);
    waiting.set(id, (rows) => {
      clearTimeout(timer);
      waiting.delete(id);
      resolve(rows);
    });
    send(id);
  });
}
