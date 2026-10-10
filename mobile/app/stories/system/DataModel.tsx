// System/Data model: every contract as a chip, columns by layer, rows by owning capability (else
// file); search, filters, a detail panel and the selection's edges to 1-3 hops (spec §2).
import { useEffect, useState } from 'react';
import { space } from '../../book/tokens.ts';
import { contracts, graph, page } from './graph.ts';
import { Grid, type Filter } from './Grid.tsx';
import { Panel } from './Panel.tsx';
import { Toolbar } from './Toolbar.tsx';
import { Link, Sheet } from './ui.tsx';

// Browser history per selection: each pick is an entry in this frame (the manager replaces its URL
// on a globals change), and Back or Forward reselects that entry's contract.
function useHistory(node: string, select: (name: string) => void) {
  useEffect(() => {
    history.replaceState({ ...history.state, node }, '');
    const back = (e: PopStateEvent) => e.state && 'node' in e.state && select(e.state.node);
    addEventListener('popstate', back);
    return () => removeEventListener('popstate', back);
  }, []);
  return (name: string) => {
    history.pushState({ ...history.state, node: name }, '');
    select(name);
  };
}

type Props = {
  node?: string;
  layer?: string;
  onSelect?: (globals: Record<string, string>) => void; // the URL globals (preview.tsx)
};

export function DataModel({ node = '', layer = '', onSelect }: Props) {
  const [selected, setSelected] = useState(node);
  const [filter, setFilter] = useState<Filter>({
    query: '',
    layer,
    owner: '',
    kind: '',
    res: '',
    hops: '',
  });
  // A globals change without a remount (Back, an edited URL) still reaches the page.
  useEffect(() => setSelected(node), [node]);
  useEffect(() => setFilter((f) => ({ ...f, layer })), [layer]);
  const select = (name: string) => {
    setSelected(name);
    onSelect?.({ node: name });
  };
  const pick = useHistory(node, select);
  const change = (f: Partial<Filter>) => {
    setFilter({ ...filter, ...f });
    if (f.layer !== undefined) onSelect?.({ layer: f.layer });
  };
  const current = contracts.get(selected);
  return (
    <Sheet>
      <Toolbar filter={filter} change={change} selected={selected} />
      <nav aria-label="Breadcrumb" style={{ marginBottom: space.md }}>
        <Link top href={page('overview')}>
          Overview
        </Link>
        {current && ` › ${current.layer} › ${current.owner ?? current.file} › ${current.name}`}
        {graph.saveTables.some((t) => t.table === selected) && ` › Save › ${selected}`}
      </nav>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.xl, alignItems: 'flex-start' }}>
        <Grid filter={filter} selected={selected} select={pick} />
        {selected && <Panel name={selected} onSelect={pick} />}
      </div>
    </Sheet>
  );
}
