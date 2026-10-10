// The tracked Beads export itself, read whole at build time (a committed copy would be stale after
// every tracker write). Its own module: only the Beads page bundles it.
import beadsRaw from '../../../../.beads/issues.jsonl?raw';

// The fields the page shows (a row also carries descriptions and notes).
export type Issue = {
  id: string;
  title: string;
  status: string;
  priority: number;
  issue_type: string;
  labels?: string[];
  dependencies?: { depends_on_id: string; type: string }[];
};

export const issues: Issue[] = beadsRaw
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));
