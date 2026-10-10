// System/Save: the save file's STRICT tables as docs/system/save.md lists them.
import { graph, repo } from './graph.ts';
import { cell, Link, Prose, Sheet } from './ui.tsx';

export const Save = () => (
  <Sheet>
    <p>
      The <code>loka-save-v1</code> tables, parsed from{' '}
      <Link href={repo('docs/system/save.md')}>docs/system/save.md</Link>. State rows hold the State
      sections; their names join in a later page.
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
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </Sheet>
);
