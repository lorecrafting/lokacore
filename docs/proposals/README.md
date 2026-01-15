# Proposals

This directory contains **proposals for future work** - features, systems, and architectural changes that are planned but not yet implemented.

## Status

All documents here describe future state, not current system behavior. Check the status header in each proposal:

- **Proposal** - Under discussion, not approved
- **Approved** - Ready for implementation
- **In Progress** - Being implemented (check linked issue)
- **Implemented** - Done, may be moved to `docs/architecture/`

## Current Proposals

| Proposal | Issue | Summary |
|----------|-------|---------|
| [Operations TUI Tool](ops-tui-tool.md) | - | Terminal UI for production operations over SSH |
| [Decentralized Autonomous Worlds](decentralized-autonomous-worlds.md) | - | IPFS-based always-on worlds with smart contract patterns |
| [Builder Content Layer](builder-content-layer.md) | `lokacore-12r` | DB storage for non-technical builder content |
| [Expo Mobile App](expo-mobile-app.md) | - | React Native mobile client |
| [Community Relay Infrastructure](community-relay-infrastructure.md) | - | P2P relay for community features |
| [Encrypted P2P Communication](encrypted-p2p-communication.md) | - | End-to-end encrypted messaging |
| [TCM Herb System Revamp](tcm-herb-system-revamp.md) | - | Redesign of herbalism/alchemy system |

## Writing Proposals

Use this template:

```markdown
# [Feature Name] - Proposal

> **Status**: Proposal (not yet implemented)
> **Issue**: `lokacore-XXX` (if tracked)
> **Last Updated**: YYYY-MM-DD

## Problem Statement
What problem does this solve? Why does it matter?

## Proposed Solution
High-level description of the approach.

## Design Details
Detailed technical design.

## Alternatives Considered
What other approaches were evaluated?

## Implementation Plan
Phased rollout, dependencies, etc.

## Open Questions
Decisions still needed.
```

## See Also

- `docs/architecture/` - Current system documentation
- `docs/game-design/` - Game mechanics and philosophy
- `docs/product/` - Business strategy and monetization
- `docs/research/` - Technical research and analysis
