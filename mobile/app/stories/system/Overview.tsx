// System/Overview: the six layers left to right with their schema files and contract counts; a
// layer opens Data model filtered to it (spec §1).
import { usePalette } from '../../book/palette.ts';
import { space, type } from '../../book/tokens.ts';
import { graph, page, repo } from './graph.ts';
import { hue } from './palette.ts';
import { Link, Sheet } from './ui.tsx';

export function Overview() {
  const c = usePalette();
  const count = (file: string) => graph.nodes.filter((n) => n.file === file).length;
  return (
    <Sheet>
      <p>
        Data flows from the cartridge through capability rules, a change (command, decision, delta,
        event), state and the save file to the GameView the{' '}
        <Link href={repo('docs/system/book-ui.md')}>Book</Link> draws. Generated from protocol/ by
        bin/contracts.exs.
      </p>
      <ol
        style={{ display: 'flex', flexWrap: 'wrap', gap: space.lg, padding: 0, listStyle: 'none' }}
      >
        {graph.layers.map((l) => {
          const files = graph.files.filter((f) => f.layer === l);
          return (
            <li
              key={l}
              style={{
                flex: '1 1 160px',
                border: `1px solid ${c.line}`,
                borderTop: `4px solid ${hue(l, c)}`,
                padding: space.md,
              }}
            >
              <h2 style={{ ...type.log, margin: 0 }}>
                <Link top href={page('data-model', { layer: l })}>
                  {l}
                </Link>
              </h2>
              <ul style={{ paddingLeft: space.xl }}>
                {files.map((f) => (
                  <li key={f.file}>{`${f.file.replace('protocol/', '')} (${count(f.file)})`}</li>
                ))}
                {l === 'Save' &&
                  graph.saveTables.map((t) => <li key={t.table}>{`table ${t.table}`}</li>)}
              </ul>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}
