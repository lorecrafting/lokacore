// The dev watcher's file events (loka-hcnlh.92). Node's recursive fs.watch on Linux watches each
// file's inode, so after the author server's atomic write (write.ts `put`: a .tmp renamed over the
// file) that watch sits on the replaced inode and the file's next write is never seen. A
// directory's watch names every child created or renamed into it, so each directory is watched (on
// every platform, so macOS runs the path CI runs); one that appears is watched when its parent names it.
import { readdirSync, statSync, watch, type FSWatcher } from 'node:fs';
import { join, relative } from 'node:path';

/** Calls `on` with each changed path under `root`, relative to it, until `close()`. */
export function watchDirs(root: string, on: (file: string) => void) {
  const dirs = new Map<string, FSWatcher>();
  const arm = (dir: string) => {
    dirs.get(dir)?.close();
    try {
      const w = watch(dir, (_, name) => {
        if (!name) return;
        const file = join(dir, name);
        try {
          if (statSync(file).isDirectory()) arm(file);
        } catch {} // gone, a loop or unreadable: not a directory to watch
        on(relative(root, file));
      });
      // a removed directory's watch ends
      dirs.set(
        dir,
        w.on('error', () => w.close()),
      );
      for (const d of readdirSync(dir, { withFileTypes: true }))
        if (d.isDirectory()) arm(join(dir, d.name));
    } catch (e) {
      // removed before it was watched: nothing to see there; else (ENOSPC: inotify's limit) say so
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.warn(`not watched: ${dir}: ${e}`);
    }
  };
  arm(root);
  return { close: () => dirs.forEach((w) => w.close()) };
}
