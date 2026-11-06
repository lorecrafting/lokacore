// The fact-read rule shared by reach.ts's report and the author panel's Trace (no imports, so the
// panel can load it): an edge that does not write its fact reads it, and a topic's fact is also
// read, since the codex (GameView topics) lists the topics whose fact holds.
export const reads = (writes: boolean, fromKind: string | undefined) =>
  !writes || fromKind === 'topic';
