// An edit's milliseconds against the brief's budgets (docs/design/story-tooling.md): the watcher
// sends the last compile's Timings; the panel and the Book's builder strip judge them here. No node
// imports, so the Book can bundle it.
/** One compile's milliseconds: the compile, then its push or write (a refusal: its notice). */
export type Timings = {
  at: number;
  compile: number;
  publish: number;
  kind: 'prose' | 'structural' | 'refusal';
  sha256?: string; // a structural edit's artifact: the Book's `ready` names it when loaded
};
export const BUDGET = {
  prose: 300,
  structural: 1500,
  refusal: 1000,
  card: 100,
  flowOpen: 300,
  flowUpdate: 100,
}; // mutate-skip: uncalibrated design value
/** One edit's milliseconds: compile and publish, and for a structural edit the Book's load until `ready`. */
export const total = (t: Timings, load: number) => t.compile + t.publish + load;
export const within = (t: Timings, load = 0) => total(t, load) <= BUDGET[t.kind];

export type Loaded = { sha256?: string; at: number };
/** A structural edit's Book load: from its publish to the Book's `ready` naming its artifact. */
export const loadOf = (t: Timings, loaded?: Loaded) =>
  t.kind === 'structural' && loaded && loaded.sha256 === t.sha256 && loaded.at >= t.at
    ? loaded.at - t.at
    : 0;
