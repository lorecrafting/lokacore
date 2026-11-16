// A Rules branch's own uiSchema (docs/design/story-tooling.md §2b K1 row 3): its titles, its tag
// hidden, and the `named` leaf keying on a condition. No React here, so the panel tests read it.
import type { RJSFSchema } from '@rjsf/utils';
import { isNamed, tagHidden } from '../../../../../kernel/ts/play/card.ts';

export const branchForm = (
  branches: RJSFSchema[],
  each: Record<string, unknown>[],
  at: number,
) => ({
  ...tagHidden(branches as never),
  ...each[at],
  // merged, not replaced: the branch's own title for that field survives the picker
  ...(isNamed(branches[at] as never) && {
    key: { ...(each[at]?.key as object), 'ui:field': 'ConditionKey' },
  }),
  'ui:label': false,
});
