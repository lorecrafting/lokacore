// System/Capabilities: who owns what, one row per registry capability (protocol/capability_registry.json).
import { graph, page } from './graph.ts';
import { cell, Link, Sheet } from './ui.tsx';

const list = (xs: string[]) => xs.join(', ');

export const Capabilities = () => (
  <Sheet>
    <table style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {[
            'Capability',
            'Portability',
            'Residency',
            'Commands',
            'Definitions',
            'Events',
            'Policy ops',
          ].map((h) => (
            <th key={h} style={cell}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {graph.capabilities.map((x) => (
          <tr key={x.id}>
            <th scope="row" style={cell}>
              {x.id}
            </th>
            <td style={cell}>{x.portability}</td>
            <td style={cell}>{x.residency}</td>
            <td style={cell}>{list(x.commands)}</td>
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
            <td style={cell}>{list(x.events)}</td>
            <td style={cell}>{list(x.policies)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Sheet>
);
