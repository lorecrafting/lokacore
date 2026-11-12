// A Scene card's source file and its writes (docs/design/scene-structure-rulings.md §3, §5), shared
// by Scene.tsx and its `.cut` pages in ScenePages.tsx to stay under the file size limits.
import { useCallback, useEffect, useState } from 'react';
import { ask, type useDiagnostics } from '../../author.ts';
import type { Context } from '../fields.tsx';

export type SceneProps = { rel: string; context: Context; diag: ReturnType<typeof useDiagnostics> };
export type Source = { bytes: string; sha256: string; text: Record<string, string> };
export type Doc = Record<string, unknown>;

/** A source file's bytes (GET /source; null when there is none), reloaded when changed outside, and
 * its writes: a refusal kept to show boxed, the last write's id kept for Undo (a refusal keeps it).
 * `post` reports whether the write went through, so a caller can act on success only. */
export function useSource(rel: string, diag: SceneProps['diag']) {
  const [file, setFile] = useState<Source | null>();
  const [undo, setUndo] = useState<string>();
  const [refused, setRefused] = useState<string>();
  const load = useCallback(
    () =>
      fetch(`/__author/source?file=${encodeURIComponent(rel)}`).then(async (r) =>
        setFile(r.ok ? await r.json() : null),
      ),
    [rel],
  );
  useEffect(() => void load(), [load]);
  const outside = diag.changes.find((c) => c.file === rel);
  useEffect(() => {
    if (file !== undefined && outside && outside.sha256 !== file?.sha256) void load();
  }, [outside]); // eslint-disable-line react-hooks/exhaustive-deps
  const post = async (path: string, sent: object) => {
    const { ok, told } = await ask(path, sent);
    setRefused(ok ? undefined : typeof told === 'string' ? told : 'Changed outside: reloaded.');
    if (ok) setUndo(path === 'undo' ? undefined : (told as { id: string }).id);
    await load();
    return ok;
  };
  const back = undo ? () => void post('undo', { id: undo }) : undefined;
  return { rel, file, post, back, refused };
}

/** What useSource returns, for a card that takes it as a prop. */
export type SceneSource = ReturnType<typeof useSource>;
