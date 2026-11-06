// A dialogue choice's links as the compiler links them (the Dialogue card's logic, E6d).
type Obj = Record<string, unknown>;

/**
 * Why a dialogue choice's `then` or `then_failed` cannot name `target`, as the compiler refuses it
 * (dialogue_links.ex:45-46, 368-399); `keys` are the dialogue keys known (none: free text). A target
 * with a keyword, quest or riddle is refused by the compile, at the field: its fields are not here.
 */
export function refuseLink(
  field: 'then' | 'then_failed',
  target: string,
  choice: Obj,
  dialogue: Obj,
  keys: string[],
) {
  if (!target) return undefined;
  if (field === 'then_failed' && choice.check === undefined) return 'then_failed needs a check';
  if (target === 'end')
    return keys.includes('end') ? 'a dialogue named end shadows end' : undefined;
  if (keys.length && !keys.includes(target)) return `no dialogue ${target}`;
  const out =
    ['patrol'].find((f) => choice[f] !== undefined) ??
    ['quest', 'riddle'].find((f) => dialogue[f] !== undefined);
  return out ? `a ${out} ends the talk: no then` : undefined;
}
