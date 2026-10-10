// System/Data model: every contract as a chip, columns by layer, rows by owning capability (else
// file); search, filters, a detail panel and the selection's 1-hop edges (spec §2).
import { useState } from 'react';
import { space } from '../../book/tokens.ts';
import { contracts, page } from './graph.ts';
import { Grid, type Filter } from './Grid.tsx';
import { Panel } from './Panel.tsx';
import { Toolbar } from './Toolbar.tsx';
import { Link, Sheet } from './ui.tsx';

type Props = {
  node?: string;
  layer?: string;
  onSelect?: (globals: Record<string, string>) => void; // the URL globals (preview.tsx)
};

export function DataModel({ node = '', layer = '', onSelect }: Props) {
  const [selected, setSelected] = useState(node);
  const [filter, setFilter] = useState<Filter>({ query: '', layer, owner: '', kind: '', res: '' });
  const select = (name: string) => {
    setSelected(name);
    onSelect?.({ node: name });
  };
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
        {!current && selected && ` › Save › ${selected}`}
      </nav>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.xl, alignItems: 'flex-start' }}>
        <Grid filter={filter} selected={selected} select={select} />
        {selected && <Panel name={selected} onSelect={select} />}
      </div>
    </Sheet>
  );
}
