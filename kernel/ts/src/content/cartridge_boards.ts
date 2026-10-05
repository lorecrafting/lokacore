import type { Diagnostic } from '../contracts.gen.ts';
import { diag, step, type Obj, type Checks } from './cartridge_refs.ts';

export function noticeBoards(details: Obj, at: string, text: Checks['text']): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [key, detail] of Object.entries(details)) {
    const board = detail.notice_board;
    if (!board) continue;
    const path = `${at}.details${step(key)}.notice_board`;
    if (detail.readable) out.push(diag('UNRESOLVED_REFERENCE', path));
    const seen = new Set<string>();
    board.notices.forEach((notice: Obj, i: number) => {
      const target = notice.detail;
      const sibling = Object.hasOwn(details, target) ? details[target] : undefined;
      text(notice, ['title'], `${path}.notices[${i}]`);
      if (target === key || seen.has(target) || !sibling?.readable)
        out.push(diag('UNRESOLVED_REFERENCE', `${path}.notices[${i}].detail`, { target }));
      seen.add(target);
    });
  }
  return out;
}
