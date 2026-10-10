// System/Save: the save file's STRICT tables as docs/system/save.md lists them.
import { graph, repo, type Graph } from './graph.ts';
import { cell, Link, Prose, Sheet } from './ui.tsx';

type Section = NonNullable<Graph['saveTables'][number]['sections']>[number];

// The State sections a state_row holds, each with the MutationTarget kinds kept in it
// (docs/state-sections.gen.json, from the kernel's row()).
export const Sections = ({ sections }: { sections: Section[] }) => (
  <ul aria-label="State sections" style={{ margin: 0 }}>
    {sections.map((s) => (
      <li key={s.section}>
        <code>{s.section}</code> ← {s.targets.join(', ')}
      </li>
    ))}
  </ul>
);

export const Save = () => (
  <Sheet>
    <p>
      The <code>loka-save-v1</code> tables, parsed from{' '}
      <Link href={repo('docs/system/save.md')}>docs/system/save.md</Link>. State rows hold the State
      sections, each listed with the MutationTarget kinds a delta writes into it.
    </p>
    <table style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={cell}>Table</th>
          <th style={cell}>Rows</th>
        </tr>
      </thead>
      <tbody>
        {graph.saveTables.map((t) => (
          <tr key={t.table}>
            <td style={cell}>
              <code>{t.table}</code>
            </td>
            <td style={cell}>
              <Prose text={t.rows} />
              {t.sections && <Sections sections={t.sections} />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </Sheet>
);
