// Metro's known-harmless WARN entries (require cycles, synchronous SQLite, pointerEvents) bury the
// author's own errors in the terminal. `quiet()` returns a line filter: false for those entries,
// true for everything else, so a real WARN or error still prints.
const NOISE = /^\w+\s+WARN\s.*(Require cycle|synchronous SQLite|pointerEvents)/;
const ENTRY = /^(Web|iOS|Android)\s/;
exports.quiet = () => {
  let skipping = false;
  return (line) => {
    if (ENTRY.test(line)) skipping = NOISE.test(line);
    return !skipping; // an entry's blank and explanatory lines follow it, until the next entry starts
  };
};
