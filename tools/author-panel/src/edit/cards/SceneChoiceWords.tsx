// A choice's words in the Scene card (docs/design/scene-structure-rulings.md §2, §5): committing new
// words pins the key the line already had, so no referrer moves. The commit sends the whole line
// through POST /set, so it is one journal entry and one Undo, like every other line edit.
import { useState } from 'react';
import { Input } from '../../components/ui/input.tsx';

/** The words field for a `- ` line. Enter commits, Escape drops the draft, and the field is read-only
 * while its save is out. A `~` placeholder shows no field: it has no words to edit yet, and pinning
 * a key there would move a placeholder a referrer may name. */
export function ChoiceWords({ label, set }: { label: string; set: (words: string) => void }) {
  const [draft, setDraft] = useState(label);
  const [sent, setSent] = useState<string>();
  const commit = () => {
    const words = draft.trim();
    if (words === '' || words === label) return;
    setSent(words);
    set(words);
  };
  return (
    <Input
      aria-label="choice words"
      className="h-7 flex-1 text-xs"
      readOnly={sent !== undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[\r\n]+/g, ' '))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault(); // the card's form must not submit
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setDraft(label);
          setSent(undefined);
        }
      }}
    />
  );
}
