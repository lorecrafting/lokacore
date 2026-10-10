// System/Overview: the six layers left to right with their schema files and contract counts; a
// layer opens Data model filtered to it (spec §1).
import { usePalette } from '../../book/palette.ts';
import { space } from '../../book/tokens.ts';
import { graph, page, repo } from './graph.ts';
import { hue } from './palette.ts';
import { heading, Link, Sheet } from './ui.tsx';

const count = (file: string) => graph.nodes.filter((n) => n.file === file).length;

function Layer({ layer }: { layer: string }) {
  const c = usePalette();
  const files = graph.files.filter((f) => f.layer === layer);
  return (
    <li
      style={{
        flex: '1 1 160px',
        border: `1px solid ${c.line}`,
        borderTop: `4px solid ${hue(layer, c)}`,
        padding: space.md,
      }}
    >
      <h2 style={{ ...heading, margin: 0 }}>
        <Link top href={page('data-model', { layer })}>
          {layer}
        </Link>
      </h2>
      <ul style={{ paddingLeft: space.xl }}>
        {files.map((f) => (
          <li key={f.file}>{`${f.file.replace('protocol/', '')} (${count(f.file)})`}</li>
        ))}
        {layer === 'Save' &&
          graph.saveTables.map((t) => <li key={t.table}>{`table ${t.table}`}</li>)}
      </ul>
    </li>
  );
}

export const Overview = () => (
  <Sheet>
    <p>
      Data flows from the cartridge through capability rules, a change (command, decision, delta,
      event), state and the save file to the GameView the{' '}
      <Link href={repo('docs/system/book-ui.md')}>Book</Link> draws. Generated from protocol/ by
      bin/contracts.exs.
    </p>
    <ol style={{ display: 'flex', flexWrap: 'wrap', gap: space.lg, padding: 0, listStyle: 'none' }}>
      {graph.layers.map((l) => (
        <Layer key={l} layer={l} />
      ))}
    </ol>
  </Sheet>
);
