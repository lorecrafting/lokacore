// Find an enabled control the way a player names it. A pressable's name leads with its shown text
// (WCAG 2.5.3, PM decision 2026-10-08), so `shown` is the exact name, or the start of exactly one name.
import assert from 'node:assert/strict';

// The status line's Contents button shows the resources, so it is found by its suffix.
export const CONTENTS = /; opens Contents, Character$/;

export function control(drawn: any[], shown: string | RegExp) {
  const all = drawn.filter((n) => n.type === 'Pressable' && !n.props.disabled);
  const named = (n: any): string => n.props.accessibilityLabel ?? '';
  const exact = all.find((n) => named(n) === shown);
  if (exact) return exact;
  const lead = all.filter((n) =>
    typeof shown === 'string' ? named(n).startsWith(shown) : shown.test(named(n)),
  );
  assert.equal(lead.length, 1, `${shown}: ${lead.length} of ${all.map(named).join(' | ')}`);
  return lead[0];
}
