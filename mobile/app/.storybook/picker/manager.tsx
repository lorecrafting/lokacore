// Loka picker, the manager side: the Pick tool button and the Polish panel (state.ts holds the
// actions, panel.tsx the panel, overlay.ts the preview layer).
import { LocationIcon } from '@storybook/icons';
import React from 'react';
import { AddonPanel, IconButton } from 'storybook/internal/components';
import { addons, types, useAddonState } from 'storybook/manager-api';
import { ADDON_ID, PANEL_ID, TOOL_ID } from './events.ts';
import { working } from './items.tsx';
import { Panel } from './panel.tsx';
import { init, initial, toggle, type State } from './state.ts';

const Tool = () => {
  const [{ on }] = useAddonState<State>(ADDON_ID, initial);
  return (
    <IconButton key={TOOL_ID} active={on} title="Pick an element (P)" onClick={() => toggle(!on)}>
      <LocationIcon />
      Pick
    </IconButton>
  );
};
const Title = () => {
  const [{ feed }] = useAddonState<State>(ADDON_ID, initial);
  const n = working(feed);
  return <span>{n ? `Polish · ${n} working` : 'Polish'}</span>;
};

addons.register(ADDON_ID, (api) => {
  init(api);
  addons.add(TOOL_ID, {
    type: types.TOOL,
    title: 'Pick',
    match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
    render: () => <Tool />,
  });
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: () => <Title />,
    render: ({ active = true }) => (
      <AddonPanel active={active}>
        <Panel />
      </AddonPanel>
    ),
  });
});
