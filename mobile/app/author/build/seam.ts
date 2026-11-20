// The Book seam (docs/rnd/in-game-builder-mode-2026-11-19.md §6.2): it counts the lines the Book
// draws, on the global, where a release bundle must not hold its name (author/seam.test.ts), and
// hands each to Build's field (field.tsx, slice 1.3) once Build.tsx gives it its hooks.
import { authorSeam } from '../../book/Text.tsx';
import { attach, line, type Hooks } from './field.tsx';

const g = globalThis as { loka_author_seam_lines?: number };
export const install = (hooks?: Hooks) => {
  if (hooks) attach(hooks);
  authorSeam.line = (p) => {
    g.loka_author_seam_lines = (g.loka_author_seam_lines ?? 0) + 1;
    return line(p);
  };
};
