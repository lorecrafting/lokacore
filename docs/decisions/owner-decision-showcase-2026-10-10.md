# Owner decision: retire the later chapters, build a toolbox showcase — 2026-10-10

Fable advised that Chapters 2 and 3 exist only as planning documents, that Chapter 1 is the
engine's regression net (its stories, end-to-end tests, hash fixtures and the E1 recorder on every
batch push), and that a showcase cartridge driven by a pairwise mechanic matrix would prove the
[mechanics toolbox](../MECHANICS-TOOLBOX.md) composes. The owner took all three recommendations
(paraphrased: drop Chapters 2 and 3 from release scope; freeze Chapter 1 as a regression fixture
until the showcase replaces it, with no further story or polish work on it; start the toolbox
showcase now, with one Fable-authored district per batch; keep every test and fixture that helps
future stories, and drop only Chapter-1-specific pins once the showcase covers them).

## Effect

1. **Chapters 2 and 3 leave release scope.** [release-scope.json](../spec/release-scope.json)
   drops them from `release_order` and drops their feature rows, which have no assigned
   release. The later ending table and story reconciliation are
   [archived](../archive/README.md).
2. **Chapter 1 is a frozen regression fixture.** No further story or polish work. It is retired
   once the showcase covers its play families (combat, death, commerce, quests, scenes,
   dialogue); then its Chapter-1-specific pins are replaced by showcase ones.
3. **The showcase starts now.** `cartridges/toolbox_showcase` grows one district per toolbox
   batch, authored at that batch's Fable final review ([SHOWCASE.md](../SHOWCASE.md)).
4. **Story-independent tests and fixtures stay.** Only Chapter-1-specific pins go, and only
   when a showcase pin covers the same behaviour.

Beads: loka-exbe.
