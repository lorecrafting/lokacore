// System/Overview: the six layers left to right, each with its schema files (title, file, contract
// count), then the Book. A layer opens Data model filtered to it (spec §1).
import type { ReactNode } from 'react';
import { usePalette } from '../../book/palette.ts';
import { space } from '../../book/tokens.ts';
import { graph, page, repo } from './graph.ts';
import { hue } from './palette.ts';
import { heading, Link, Sheet, small } from './ui.tsx';

const count = (file: string) => graph.nodes.filter((n) => n.file === file).length;

// One box in the layer map, its top rule in the layer's hue (Book has none: c.line).
function Box({ layer, href, children }: { layer: string; href: string; children?: ReactNode }) {
  const c = usePalette();
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
        <Link top={layer !== 'Book'} href={href}>
          {layer}
        </Link>
      </h2>
      {children}
    </li>
  );
}

const Layer = ({ layer }: { layer: string }) => (
  <Box layer={layer} href={page('data-model', { layer })}>
    <ul style={{ paddingLeft: space.xl }}>
      {graph.files
        .filter((f) => f.layer === layer)
        .map((f) => (
          <li key={f.file}>
            {f.title}{' '}
            <span style={small}>{`${f.file.replace('protocol/', '')} (${count(f.file)})`}</span>
          </li>
        ))}
      {layer === 'Save' && graph.saveTables.map((t) => <li key={t.table}>{`table ${t.table}`}</li>)}
    </ul>
  </Box>
);

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
      <Box layer="Book" href={repo('docs/system/book-ui.md')} />
    </ol>
  </Sheet>
);
