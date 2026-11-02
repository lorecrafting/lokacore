// Metro's known-harmless WARN entries (require cycles, synchronous SQLite, pointerEvents) bury the
// author's own errors in the terminal. `quiet()` returns a line filter: false for those entries,
// true for everything else, so a real WARN or error still prints.
const NOISE = /^\w+\s+WARN\s.*(Require cycle|synchronous SQLite|pointerEvents)/;
// After a noisy entry only its blank line and Metro's one explanatory line follow; anything else is real.
const TAIL = /^(\s*$|Require cycles are allowed)/;
exports.quiet = () => {
  let skipping = false;
  return (line) => {
    skipping = NOISE.test(line) || (skipping && TAIL.test(line));
    return !skipping;
  };
};
