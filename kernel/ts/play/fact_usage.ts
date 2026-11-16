// A fact's row in F1's table (docs/design/story-tooling.md F1 and W4), shared by reach.ts's
// `factUsage` and the author panel's Facts table (no imports, so the panel can load it).
export type FactUsage = {
  ref: string;
  key: string;
  value_type: { type: string; default: unknown; minimum?: number; maximum?: number };
  scopes: string[];
  meaning?: string;
  read: number;
  write: number;
  status: 'unused' | 'write_only' | 'read_only' | 'both';
  reach: number; // default + the once-only fact.adjust amounts, for an int (L2a's reach)
};
