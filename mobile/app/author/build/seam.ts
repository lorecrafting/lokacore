// The Book seam's first implementation (slice 1.1, docs/rnd/in-game-builder-mode-2026-11-19.md §6.2):
// it only counts the lines the Book draws, on the global, where a release bundle must not hold its
// name (author/seam.test.ts). The builder's fields and pencils replace it.
import { authorSeam } from '../../book/Text.tsx';

const g = globalThis as { loka_author_seam_lines?: number };
export const install = () => {
  authorSeam.line = (p) => {
    g.loka_author_seam_lines = (g.loka_author_seam_lines ?? 0) + 1;
    return p;
  };
};
