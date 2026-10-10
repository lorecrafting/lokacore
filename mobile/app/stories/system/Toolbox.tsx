// System/Toolbox: the ranked mechanics toolbox (docs/MECHANICS-TOOLBOX.md), filtered by batch and
// status, each installed row linked to its rules in docs/system/mechanics.md.
import { useState } from 'react';
import { repo } from './graph.ts';
import { distinct, toolbox, type Row } from './pages.ts';
import { cell, Choose, Link, Prose, Sheet, Table } from './ui.tsx';

const ToolboxRow = ({ r }: { r: Row }) => (
  <tr>
    <th scope="row" style={cell}>
      {r.id}
    </th>
    <td style={cell}>{r.batch}</td>
    <td style={cell}>
      <Prose text={r.title} />
      {r.section && (
        <>
          {' '}
          <Link href={repo(r.section)}>rules</Link>
        </>
      )}
    </td>
    <td style={cell}>{r.depends.join(', ')}</td>
    <td style={cell}>
      <Prose text={r.status} />
    </td>
  </tr>
);

export function Toolbox() {
  const [batch, setBatch] = useState('');
  const [state, setState] = useState('');
  const rows = toolbox.filter(
    (r) => (!batch || r.batch === batch) && (!state || r.state === state),
  );
  return (
    <Sheet>
      <p>
        Parsed from <Link href={repo('docs/MECHANICS-TOOLBOX.md')}>docs/MECHANICS-TOOLBOX.md</Link>,
        in build order.
      </p>
      <p>
        <Choose label="Batch" options={distinct(toolbox.map((r) => r.batch))} set={setBatch} />
        <Choose label="Status" options={distinct(toolbox.map((r) => r.state))} set={setState} />
      </p>
      <Table label="Toolbox rows" heads={['#', 'Batch', 'Mechanic', 'Depends on', 'Status']}>
        {rows.map((r) => (
          <ToolboxRow key={r.id} r={r} />
        ))}
      </Table>
    </Sheet>
  );
}
