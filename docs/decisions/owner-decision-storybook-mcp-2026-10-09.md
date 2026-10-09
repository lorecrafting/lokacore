# Owner decision: Storybook MCP addon and the Chrome extension for agents — 2026-10-09

The PM proposed giving agents a Tidewave-like loop on the Book UI: Storybook's official MCP addon
(list and read components and stories, write stories, run their interaction and a11y tests) plus
the Claude in Chrome extension (console and clicks). Owner's words, 2026-10-09 (source: Beads
loka-zs7):

> yes to the storybook mcp addon and connect chrome extension

## Effect

- `@storybook/addon-mcp` is registered in `mobile/app/.storybook/main.ts`; the dev server answers
  MCP at `/mcp`. The repo-root `.mcp.json` points Claude Code at the owner's Storybook
  (http://localhost:6006/mcp).
- How to use it: [web preview, Storybook](../web-preview.md#storybook).
