// Hand-made props shared by the leaf stories.
import type { Button } from '../book/presenter.ts';

// A hand-made offered button (no token: no freshness check).
export const button = (label: string, more: Partial<Button> = {}): Button => ({
  label,
  action_key: label,
  target_ids: [],
  input: {},
  ...more,
});
