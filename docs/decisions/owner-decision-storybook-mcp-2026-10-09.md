# Owner decision: Storybook MCP addon, Tidewave toolbar and the Chrome extension for agents — 2026-10-09

The PM proposed giving agents a Tidewave-like loop on the Book UI: Storybook's official MCP addon
(list and read components and stories, write stories, run their interaction and a11y tests) plus
the Claude in Chrome extension (console and clicks). Owner's words, 2026-10-09 (source: Beads
loka-zs7):

> yes to the storybook mcp addon and connect chrome extension

After a local spike put the Tidewave toolbar on the dev Storybook, the owner added, 2026-10-09:

> Okay merge in and keep the tidewave trial for now.  If we decide to make our own slimmed down version and delete it later, we can

## Effect

- `@storybook/addon-mcp` is registered in `mobile/app/.storybook/main.ts`; the dev server answers
  MCP at `/mcp`. The repo-root `.mcp.json` points Claude Code at the owner's Storybook
  (http://localhost:6006/mcp).
- The owner chose, 2026-10-09 (paraphrased): Storybook stays on this computer by default, since
  `/mcp` has no authentication; `npm run storybook:lan` opens it to the network for phone sessions.
- Tidewave (trial): `storybook dev` only, never the build or the smoke, loads Tidewave's toolbar
  and serves its MCP at `/tidewave/mcp`, also in `.mcp.json`. The toolbar is a hosted script
  (https://tidewave.ai/tc/toolbar.js) with a free tier of 10 prompts a month; a slim version of
  our own may replace it later.
- How to use it: [web preview, Storybook](../web-preview.md#storybook).
