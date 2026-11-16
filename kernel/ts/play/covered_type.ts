// R2's coverage answer (docs/design/story-tooling.md `### R2`): each story node ref by the checkpoint
// names reaching it. Its own module with no imports so the author panel's `tsc -b`, which has no node
// types, can read the type without pulling in covered.ts's SQLite and fs.
export type Covered = Record<string, string[]>;
