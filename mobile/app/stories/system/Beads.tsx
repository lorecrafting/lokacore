// System/Beads: the tracked Beads export (.beads/issues.jsonl) as of this build, filtered by status.
import { useState } from 'react';
import { repo } from './graph.ts';
import { distinct, issues, type Issue } from './pages.ts';
import { cell, Choose, Link, Sheet, Table } from './ui.tsx';

const heads = ['Issue', 'Title', 'Status', 'Priority', 'Type', 'Labels', 'Blocked by'];

const IssueRow = ({ i }: { i: Issue }) => (
  <tr>
    <th scope="row" style={cell}>
      {i.id}
    </th>
    <td style={cell}>{i.title}</td>
    <td style={cell}>{i.status}</td>
    <td style={cell}>P{i.priority}</td>
    <td style={cell}>{i.issue_type}</td>
    <td style={cell}>{(i.labels ?? []).join(', ')}</td>
    <td style={cell}>
      {(i.dependencies ?? [])
        .filter((d) => d.type === 'blocks')
        .map((d) => d.depends_on_id)
        .join(', ')}
    </td>
  </tr>
);

export function Beads() {
  const [status, setStatus] = useState('');
  return (
    <Sheet>
      <p>
        The tracker export <Link href={repo('.beads/issues.jsonl')}>.beads/issues.jsonl</Link> as
        committed at this build; <code>br show &lt;id&gt;</code> has the notes.
      </p>
      <p>
        <Choose label="Status" options={distinct(issues.map((i) => i.status))} set={setStatus} />
      </p>
      <Table label="Beads issues" heads={heads}>
        {issues
          .filter((i) => !status || i.status === status)
          .map((i) => (
            <IssueRow key={i.id} i={i} />
          ))}
      </Table>
    </Sheet>
  );
}
