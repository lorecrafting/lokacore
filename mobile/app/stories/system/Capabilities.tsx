// System/Capabilities: who owns what, one row per registry capability (protocol/capability_registry.json).
import { graph, page, type Capability } from './graph.ts';
import { cell, Link, Sheet } from './ui.tsx';

const heads = [
  'Capability',
  'Portability',
  'Residency',
  'Commands',
  'Definitions',
  'Events',
  'Policy ops',
];

const Row = ({ x }: { x: Capability }) => (
  <tr>
    <th scope="row" style={cell}>
      {x.id}
    </th>
    <td style={cell}>{x.portability}</td>
    <td style={cell}>{x.residency}</td>
    <td style={cell}>{x.commands.join(', ')}</td>
    <td style={cell}>
      {x.definitions.map((d, i) => (
        <span key={d.kind}>
          {i > 0 && ', '}
          {d.node ? (
            <Link top href={page('data-model', { node: d.node })}>
              {d.kind}
            </Link>
          ) : (
            d.kind
          )}
        </span>
      ))}
    </td>
    <td style={cell}>{x.events.join(', ')}</td>
    <td style={cell}>{x.policies.join(', ')}</td>
  </tr>
);

export const Capabilities = () => (
  <Sheet>
    <table style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {heads.map((h) => (
            <th key={h} style={cell}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {graph.capabilities.map((x) => (
          <Row key={x.id} x={x} />
        ))}
      </tbody>
    </table>
  </Sheet>
);
