// The System/Checks and Toolbox pages' data, read whole at build time (no network):
// docs/checks.gen.json and docs/toolbox.gen.json (bin/system_pages.exs).
import checksRaw from '../../../../docs/checks.gen.json?raw';
import toolboxRaw from '../../../../docs/toolbox.gen.json?raw';

export type Check = { name: string; text: string };
export type Row = {
  id: string;
  batch: string;
  title: string;
  depends: string[];
  status: string; // the table's text
  state: string | null; // its leading word: todo, done, in progress, merged into, split into, deferred
  section: string | null; // docs/system/mechanics.md#heading of the installed rules
};
export const checks: Check[] = JSON.parse(checksRaw);
export const toolbox: Row[] = JSON.parse(toolboxRaw);

// Distinct values in first-seen order (the toolbox's batches stay in rank order).
export const distinct = (xs: (string | null)[]) => [
  ...new Set(xs.filter((x): x is string => x !== null)),
];
