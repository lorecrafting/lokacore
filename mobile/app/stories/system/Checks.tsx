// System/Checks: the gates docs/CHECKS.md lists, one row per check. No result column: hosted CI
// holds the runs and no result is committed (spec §6 PR3).
import { repo } from './graph.ts';
import { checks } from './pages.ts';
import { cell, Link, Prose, Sheet, Table } from './ui.tsx';

export const Checks = () => (
  <Sheet>
    <p>
      Parsed from <Link href={repo('docs/CHECKS.md')}>docs/CHECKS.md</Link>. Results are in the
      branch's GitHub Actions runs.
    </p>
    <Table heads={['Check', 'What it holds']}>
      {checks.map((c) => (
        <tr key={c.name}>
          <th scope="row" style={cell}>
            <Prose text={c.name} />
          </th>
          <td style={cell}>
            <Prose text={c.text} />
          </td>
        </tr>
      ))}
    </Table>
  </Sheet>
);
