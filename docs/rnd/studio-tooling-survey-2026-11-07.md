# Big-studio narrative tooling: survey and proposals (loka-wfrgk.114)

The owner asked (paraphrased): compare and learn from all the big studios' tools, broadly and exhaustively;
if the engine needs to change, it can. This doc widens [story tooling](../design/story-tooling.md), which stayed
inside the current engine, to engine, protocol and compiler changes where they earn their place. Informative;
the owner picks, and each pick becomes a slice ([build order](../design/story-tooling.md#5-build-order)).

- Method: four research passes (Larian, BioWare, Obsidian, Owlcat, inXile; Bethesda, CD Projekt Red, Ubisoft,
  Naughty Dog, Rockstar; ZA/UM, Inkle, Failbetter, Valve, Campo Santo, Supergiant and the tools; cross-cutting
  practice), each item marked **sourced** (the page was fetched), **secondary** (a wiki, forum, press piece or
  search snippet restating it) or **unverified** (memory only; do not quote as fact). GDC Vault bodies are
  members-only, so talks are cited by their abstract plus a press write-up.
- Not restated here: the [BG3 design lessons](baldurs-gate-3-lessons-2026-11-04.md) (reactivity, n+1 fallback,
  companions), the [story map's tool comparison](story-map-design-2026-11-05.md#2-what-the-industry-does-and-what-fits-a-solo-author-on-a-mud-like-engine)
  (articy, Arcweave, Twine, Inform's Index, Creation Kit, REDkit as *views*), the
  [RPG innovations](rpg-genre-innovations-2026-11-04.md) (Radiant's caution, storylets as content), and the
  [primitives table](../design/story-tooling.md#1-what-the-compile-already-gives), which every "Loka today" cell
  below assumes.
- No player-facing words; an example line is `~`.

## 0. Decisions at a glance

| # | Proposal | Layer | Tier | In one line |
|---|---|---|---|---|
| W1 | **Roam**: random-walk coverage over the real authority | tools (`kernel/ts/play`) | now, after R1 | Every studio that ships branching has a bot that plays at random and reports what nothing reached; Loka has the generator (`sim.ts`), the long-run policy (`flows.ts`) and the marker (`coverage.ts`) and has never pointed them at story content |
| K2 | `once` and `cooldown` on reactions | compiler | now | Dialogue choices lower `once` to an engine fact; reactions make the owner write the fact, the `not`, the assign and `silent` by hand |
| W2 | A rename rewrites the checkpoints | editor (`/restructure`) | now, with the in-flight route | Ink's and CDPR's save-breaking lesson, applied to the one recorded-path format Loka has |
| L2 | Three lint rows: threshold never reachable; dialogue with no fallback choice; `meaning` missing | lint (Elixir) | now, with L1 | Failbetter's and BioWare's two oldest rules, definite from the source |
| K1 | Named conditions, inlined at compile | compiler | before v1 | BioWare's defined flags, Osiris's QRY, Yarn's smart variables: one definition of `~trusts you`, read in twenty places |
| E1 | A conditional page in a modal scene (`when` on `narrate`) | engine (scene@1) | before v1; owner question | The cheapest engine change that makes a cutscene remember; Bethesda's scene phases skip on a failed start condition |
| W3 | A lines sheet (`bin/loka lines`) | tools | before v1 | Every voice, localisation and proofreading pipeline starts from one keyed sheet with speaker, source line and gate |
| E2 | A rule trace on the decision | engine (decision contract) | later; decided "budget first" | The exact source D1 lacks; costs a contract bump and every hash fixture |
| — | Event arbitration and throttles (Story Manager, Legion's PAS); salience scoring; model checking; save migration machinery | engine | rejected or later | Each is right for a team of fifty; the reasons are in section 4 |

Top ten in order: R1, W1, D1, K2, C1, L1 + L2, W2, F1 (+ W4 columns), R2, K1. The owner's decided order
(R1, D1, C1, L1, F1, R2) stands; W1 and K2 are a reopen, question 1.

## 1. Survey by studio

Each bullet: the mechanism, then the source and its mark.

### Larian (Divinity Engine, Osiris, BG3)

- **Osiris** is one story split into goals (INIT, KB rules, EXIT); a rule is `IF trigger AND conditions THEN actions`,
  the trigger an engine event or a database fact being defined; rules run top to bottom in alphabetical goal order,
  so shared PROCs live in goals named with leading underscores; a frame is atomic, so a save never lands mid-rule.
  Facts live in typed `DB_` tables; `QRY` is the OR escape hatch; EXIT sections remove databases "so savegames
  stay smaller". [Osiris overview](https://docs.larian.game/Osiris_Overview) (official), **sourced**.
- **Design patterns** the docs name: `NOT DB_DoneOnce(1)` last in a rule to fire once; events fire when a fact is
  defined, never when removed, so removal needs a helper DB; one goal per region.
  [Osiris design patterns](https://docs.larian.game/Osiris_Design_Patterns), **sourced**.
- **Story patching**: the compiled story sits in the save; a newer mod version dumps every fact, swaps the rules
  and reimports the facts "without triggering any rules that depend on them"; goals match by name; INIT edits never
  reach a save where the goal was already active; a `DB_ModVersion(n)` fact plus `SavegameLoaded` rules is the
  migration idiom. [Versioning](https://docs.larian.game/Modding:_Versioning), **sourced**. In Early Access, Patch
  3 broke saves and Larian kept the old build on a beta branch rather than migrate (GamesRadar, **secondary**).
- **Dialog editor flags** have scopes: Local (per dialogue), Tag, Script (computed, read-only), Global, Character
  or Object, User, Party; nodes carry Flags to Check and Flags to Set; "Advanced play" pre-sets flags to reach a
  gated node; find-in-files over flags. [Dialog editor](https://docs.larian.game/Dialog_editor), **sourced**. A
  shipped BG3 dialog dump shows scopes Global, Local, Object, Dialog, Quest and a dangling flag reference that
  shipped ("flag template not found"). [Community dump](https://krazplay.github.io/bg3/dialogs/Act1_Chapel.html), **sourced**.
- **Debugger**: official docs offer `DebugBreak` and the compiler's orphan-query report (databases only defined or
  only checked). The capable one is Norbyte's VS Code adapter over the Script Extender: breakpoints (never on the
  triggering event), step, rule variables. [Norbyte's notes](https://gist.github.com/Norbyte/8b7eb35cd17f799ea113636b15e1f967), **sourced**.
- **World Tester**: headless machines run a bot that saves, loads, walks dialogue options and drives UI at speed,
  logging crashes and heat maps; the first gate before human QA. [Vice interview](https://www.vice.com/en/article/how-an-ai-called-the-world-tester-helped-make-baldurs-gate-3-a-reality), **sourced**.
- **Testing the endings**: a spreadsheet "scroll after scroll" and "a small army" of end-to-end players
  (Chrystal Ding, BAFTA 2024; PC Gamer reprint, **sourced**). Co-op roleplay inside conversations was cut: "our
  dialogue trees blew up so hard" (Vincke, **secondary**).

### BioWare (Dragon Age toolset, Mass Effect, Keep)

- A **plot** is "a bundle of boolean values": 128 stored flags per plot file plus *defined* flags computed by a
  script on read (`EVENT_TYPE_GET_PLOT`); setting fires `EVENT_TYPE_SET_PLOT`; the editor slowed past about 800
  defined flags. [Plot](https://datoolset.net/wiki/Plot), **sourced**.
- **Conversation lines** carry one Condition (a plot flag or a `StartingConditional` script, never both) and one
  Action (set a flag, run a script); the convention is that the last line in a block has no condition, so dialogue
  falls through to a default. [Conversation plots and scripting](https://datoolset.net/wiki/Conversation_plots_and_scripting), **sourced**.
- **"Writing the BioWare Way"** (AGDC 2007): the Story Manager tracks states (default false) and surfaces inside
  the dialogue editor; "if an interaction was too complicated for the tools it was too complicated for the game".
  [Game Developer write-up](https://www.gamedeveloper.com/game-platforms/agdc-bioware-charts-writing-for-i-mass-effect-i-), **sourced**.
- **Save import**: "literally hundreds" of ME1 variables read at the moment they matter (Hudson 2009,
  [Gematsu](https://gematsu.com/2009/07/bioware-explains-how-saves-work-in-mass-effect-2), **sourced**); the
  DAO to DA2 import carried about 600 data points and the pain led to the **Keep**, a cloud world-state editor
  with a logic validator (**secondary**).

### Obsidian (Pillars, Tyranny, Outer Worlds)

- **Conversation files**: nodes with `Persistence` (`None`, `OnceEver`, `MarkAsRead`), a `Conditionals` block
  (And/Or over calls such as `IsGlobalValue(name, op, int)` and `HasConversationNodeBeenPlayed`), `OnEnterScripts`
  (`SetGlobalValue`, `IncrementGlobalValue`, `DispositionAddPoints`); globals named `n_` (int) and `b_` (bool).
  [Extracted file](https://gist.github.com/anonymous/58be523f03bd24173bd0), **sourced**.
- **Reputation**: two counters per faction (positive, negative) plus a scale; dispositions accrue hidden points
  per choice and gate mostly flavour (wiki and forums, **secondary**). **Tyranny's Conquest** writes the starting
  world state as ordinary globals with readable names ([RPG Codex](https://rpgcodex.net/article.php?id=10248), **sourced**).
- Sawyer: data tracking lets writers count how often NPCs reacted to a variable; Pentiment dropped flat visible
  checks because players "always pick this option" (PCGamesN, **secondary**).

### Owlcat (Pathfinder, Rogue Trader)

- Unity **blueprints** as JSON with GUIDs; conditions and actions are component lists; **etudes** are a hierarchy
  of world-state nodes whose elements are both conditions and start actions; decisions live in flags, etudes and
  quest results (ToyBox docs, **secondary**; no first-party description found, **unverified**).
- After Kingmaker they computed they would need 23 manual testers every day and instead built QA bots that play
  around the clock ([GameSpace](https://www.gamespace.com/all-articles/news/pathfinder-wrath-of-the-righteous-lessons-from-kingmaker-dhampir-playable-race/), **sourced**; the Kickstarter QA post, **unverified**).

### inXile (Torment, Wasteland 3)

- Torment used Obsidian's editor: conditionals from a searchable preset list; nodes default to once-ever; identical
  text tagged Lie or Truth; "Perform Task" auto-generates success, failure and crit branches; conversations authored
  "50% faster". [Update 38](https://rpgcodex.net/article.php?id=9749), **sourced**.
- Reactivity review as process: reviewers check whether the player *could* ask a thing and whether NPCs react; Ziets
  read every line of his zone ([RPGWatch](https://rpgwatch.com/articles/torment--tides-of-numenera-interview-406.html), **sourced**).
  Wasteland 3's level designers spent most days on "the variables and conditions that allow that reactivity", with
  hard-to-trace bugs ([CogConnected](https://cogconnected.com/feature/wasteland-3-interview-with-jeremy-kopman/), **sourced**).

### Bethesda (Creation Kit)

- **Quests**: integer stages, each with conditioned log entries and a Papyrus fragment; flags Start Game Enabled,
  Run Once, Allow Repeated Stages ("`SetStage` has no effect after it is called the first time" otherwise); "if
  aliases fail to fill, the entire quest will fail". **Aliases** are slots filled six ways (specific, unique actor,
  external alias, created, from event, condition search). **Story Manager**: event nodes to branch nodes to quest
  nodes, each with conditions; an event is consumed by the first quest that starts unless the node shares it; max
  concurrent quests and hours-until-reset throttles. **Conditions** are one row format (function, run-on target,
  operator, value, OR flag) used on dialogue, stages, aliases, packages, scenes and nodes. **Dialogue**: quest,
  branch (blocking or normal), topic, info with Say Once, Random, Goodbye, Invisible Continue. **Scenes**: phases
  with start conditions ("if they fail, that phase is skipped entirely"). All CK wiki text from search snippets
  (the site refused fetches), **secondary**; house style from the [Arcane University](https://wiki.beyondskyrim.org/wiki/Arcane_University:Implementation_Scribe_Assignment), **sourced**.
- **Radiant**: Nesmith lists 30 player actions and reactions, cut the ones that over-fired ("half the town crowding
  around every dropped item"), never used it for the main quest ([GamesBeat](https://gamesbeat.com/bethesdas-nesmith-reflects-on-the-difficult-birth-of-skyrims-radiant-story-system/), **sourced**).
- **Voice files** are named from quest, topic, info FormID and line; Export Dialogue writes a line sheet with
  "File Found" per line (**secondary**). **Saves**: script and quest state are baked in; "there is no such thing
  as a clean save"; test from a new game (community, **secondary**).

### CD Projekt Red (REDengine, Witcher 3, Cyberpunk 2077)

- **Facts**: a fact is a name and a signed integer; "quest facts do not exist until they are explicitly set,
  until then they are assumed to be 0"; read with `< <= == >= >` in a Pause or Condition node; names start with the
  quest code by convention; "editing quest facts will almost always cause additional problems" because later checks
  combine several. [REDmodding wiki](https://wiki.redmodding.org/cyberpunk-2077-modding/for-mod-creators/files-and-what-they-do/quests-facts-and-files), **sourced**.
- **Quest graph**: signal flow through phase, pause, condition, and, xor, random, script and scene blocks;
  entities addressed by tag. Deleting a node leaves a **deletion marker** "which keeps the signal from dying when a
  quest is updated in a patch". [Conditions how-to](https://cdprojektred.atlassian.net/wiki/spaces/W3REDkit/pages/135987240/HOW-TO+Use+quest+conditions+and+functions), **sourced**; the marker page, **secondary**.
- **Quests Debugger**: opens the quest tree against the last loaded save, highlights active signals, "continue from
  that node" on any pin, a Facts tab with values and expiry, filterable, editable.
  [Tool page](https://cdprojektred.atlassian.net/wiki/spaces/W3REDkit/pages/6328642/TOOL+Quests+Debbuger), **sourced**.
- **Scene editor**: sections of lines (voicetag plus text), one choice per section at its end, each choice an output
  pin; condition and script blocks between sections. [Scene editor](https://redkitwiki.cdprojektred.com/scene+editor.htm), **sourced**.
  **Community editor**: NPC spawn rows grouped by story phase, switched by a quest node.
  [Community editor](https://redkitwiki.cdprojektred.com/community+editor.htm), **sourced**.
- Kaer Morhen's 9 to 16 possible allies were handled by enumerating combinations (Sasko,
  [Shacknews](https://www.shacknews.com/article/94509/witcher-3-quest-designers-talk-design-process-most-difficult-quest-to-create), **sourced**).

### Ubisoft, Naughty Dog, Rockstar (public material is thin)

- Odyssey's Story Creator is the internal quest editor exposed ([Ubisoft](https://www.ubisoft.com/en-us/company/how-we-make-games/creative-process/articles/how-assassin-s-creed-odyssey-s-story-creator-mode-actually-works), **sourced**).
  Legion's **Census** is a relational database of generated people; its **Player Attention System** arbitrates
  competing mission starts by priority, relevance window and attention cost, built because "each mission decided
  for itself when to start" ([Ubisoft](https://news.ubisoft.com/en-ca/article/4po3S9Pwp1YcgBmGPmQxAh/watch-dogs-legion-the-tools-that-built-london), **sourced**).
- Naughty Dog's **state scripts** (GDC 2009): named states with begin, update, end and event handlers, attached to
  objects, triggers, directors or tasks ([slides](https://www.slideshare.net/slideshow/statebased-scripting-in-uncharted-2-among-thieves/7093984), **sourced**);
  barks are a rule database owned by sound designers (GDC 2014 abstract, **sourced**).
- Rockstar: gang memory of player deeds, honour-gated branches added after replay testing found mission conflicts
  (Sarwar, **sourced** via Wccftech); procedural companion missions prototyped and cut (**secondary**). No tooling
  is public; mission debugging, **unverified**.

### ZA/UM (Disco Elysium)

- Written directly in **articy:draft**; the rule for state: when a moment is memorable, "tag it with a Boolean"
  and keep strict naming so variables can be found again; testing began with a document of the expected path
  through every task, then a search for variant paths ([articy case study](https://www.articy.com/en/showcase/disco-elysium/), **sourced**).
  The script grew until articy froze (Noclip ep. 3, **sourced** via press).
- **Micro-reactivity** (Keenan, GDC 2021): a trivial choice sets a boolean every later mention checks; four player
  call-signs cost 428 new cards, each localised and voiced ([Game Developer](https://gamedeveloper.com/business/understanding-the-meaningless-micro-reactive-and-marvellous-writing-of-i-disco-elysium-i-), **sourced**).
- **Thought Cabinet**: 53 thoughts, a slot, 30 minutes to 3 days of in-world time to internalise, partial info while
  in progress, a reveal on completion; gates options and events ([dev blog mirror](http://www.gamebanshee.com/39hc9), **sourced**).
  **Checks**: red once, white retried after the skill gains, passive checks run hidden and inject voices (fan
  analysis, **sourced**; the exact "reopens when a referenced variable changes" rule, **unverified**).

### Inkle (ink, Heaven's Vault, Sorcery!, 80 Days)

- **ink**: knots, stitches, `*` once-only and `+` sticky choices, gathers, labels; every name is a read count usable
  as a condition, so visit history is state without declaring variables; `TURNS_SINCE`; lists as state machines;
  tags for metadata ([Writing with ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md), **sourced**).
- **What breaks a save**: state stores structural paths by order (`0.c-0`), so inserting a choice or gather shifts
  old saves onto the wrong content; labelled points are stable; hide retired choices with `{false}` rather than
  delete ([Inky issue 253](https://github.com/inkle/inky/issues/253), maintainer reply, **sourced**).
- **Heaven's Vault**: conversations moved to an always-available bank filtered by a knowledge model; each line
  carries a necessary condition and a *redundancy* condition (is it now moot); selection moved from a priority list
  to recency ("what was the last state to be set? That's what the protagonist is thinking about")
  ([Ingold](https://gamedeveloper.com/business/ideas-and-dynamic-conversation-in-heaven-s-vault), **sourced**).
- **Testing**: Inky previews live and rewinds; Ingold wrote auto-players that search for dead ends
  ([MCV](https://mcvuk.com/development-news/want-your-story-to-drive-your-game-rather-than-vice-versa-inkle-and-failbetter-discuss-the-storytelling-potential-of-the-open-source-ink), **sourced**);
  [ink-proof](https://github.com/chromy/ink-proof) is story plus choice script plus expected transcript, diffed per
  runtime (**sourced**); [Ink-Tester](https://github.com/wildwinter/Ink-Tester) plays thousands of random runs
  and prints per-line hit counts (**sourced**).
- **Sorcery!**: rewind lives on the map's journey line, not inside passages; 695 variables carried between parts;
  postmortem regrets: a stat mutated directly instead of derived, a system in a switch statement instead of data,
  two save formats ([postmortem](https://gamedeveloper.com/business/postmortem-i-steve-jackson-s-sorcery-i-series-by-inkle), **sourced**).

### Failbetter, Weather Factory (quality-based narrative)

- **Qualities** are integers; **storylets** unlock when qualities meet requirements and their branches adjust
  qualities; content can be met in any order, gated on aggregates not path history
  ([Short, Beyond Branching](https://emshort.blog/2016/04/12/beyond-branching-quality-based-and-salience-based-narrative-structures/), **sourced**).
- **What went wrong** (Failbetter 2011): QBN "isn't good at having a series of things that need to happen in
  order"; one quality used "to do different things in different places" caused inconsistency and exploits; rule of
  parsimony ([Don't poke that](https://www.failbettergames.com/dont-poke-that-narrative-engineering-principles-part-1), **sourced**).
- StoryNexus decks, must-sequences and montage ([Short](https://emshort.blog/2017/07/25/montage-and-other-effects-in-storynexus/), **sourced**);
  Kreminski's four storylet dimensions ([ICIDS 2018](https://mkremins.github.io/publications/Storylets_SketchingAMap.pdf), **sourced**).
  Weather Factory's recipes match on aspect multisets in JSON content files with `extends` (**sourced**).

### Valve (response rules, Director)

- **Rule database** (Ruskin, GDC 2012): the game poses a query of facts; every rule's criteria are scored; the rule
  matching the most criteria wins, ties random, generic rules are fallbacks; writers add specific rules without
  touching the rest ([Radiator notes](https://www.blog.radiator.debacle.us/2012/07/rule-databases-for-contextual-narrative.html),
  [Short](https://emshort.blog/2012/03/16/gdc-2012-talk-on-dynamic-dialogue/), **sourced**). Response groups carry
  `speakonce`, `norepeat`, `then` follow-ups and `applycontext` facts with expiry (Valve wiki, fetch refused,
  **secondary**; `then` details, **unverified**).
- **AI Director** (Booth, AIIDE 2009): a few scalar intensity facts drive a four-state pacing machine
  ([slides](https://cdn.fastly.steamstatic.com/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf), **sourced**).

### Campo Santo, Supergiant

- Firewatch's dialog system grew from barks into interruptible conversations that resume; the GDC 2017 talk is
  about what a data-driven system must handle as it grows and keeping tools alive without a tools team
  ([abstract](https://gdcvault.com/play/1024000/Do-You-Copy-Dialog-System), **sourced**; body, **unverified**).
  Silence is a valid choice; branches change lines, not plot (Kotaku, **sourced**).
- Hades: 22,000 lines, all voiced, under 20 people; a line enters the candidate pool when its requirements hold,
  priority and weights pick; "we don't know how things are going to be sequenced" (Kasavin,
  [Game Developer](https://gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death), **sourced**).
  The Lua field names (`GameStateRequirements`, `RequiredTextLines`, `Cooldowns`) appear in modding APIs with no
  documented semantics, **unverified**.

### Tools (Yarn Spinner, Twine, articy, Arcweave, Dialogue System, Chat Mapper)

- **Yarn Spinner**: `<<if>>` blocks; options with failed conditions are still delivered marked unavailable, and a
  group with none available is skipped so a default line follows; **smart variables** are declared expressions
  recomputed on read; v3 **saliency** scores a candidate by its condition complexity (`once` +1, +1 per expression)
  with strategies First, Best, Best Least Recently Viewed, Random BLRV; every line gets a project-unique `#line:` ID
  and a `lock` hash flags changed source as "NEEDS UPDATE" ([docs](https://docs.yarnspinner.dev/next/3-new-in-v3/language-features/saliency), **sourced**).
  A theorem-prover **Story Solver** for soft locks and unreachable content is in closed alpha ([page](https://yarnspinner.dev/storysolver/), **sourced**).
- **Twine**: Harlowe's Debug Mode has a variables panel with "copy all as one `(set:)`", a turns dropdown to jump
  back and step-by-step replay of macro evaluation ([manual](https://twine2.neocities.org/), **sourced**);
  SugarCube exposes `Config.saves.version` and `onLoad` migrations ([docs](https://www.motoslave.net/sugarcube/2/docs/), **sourced**).
- **articy:draft**: conditions on input pins, instructions on output pins, typed variable sets; **simulation
  mode** records journeys with per-journey variable overrides and highlights the failing sub-expression in red
  ([help](https://www.articy.com/help/adx/Presentation_Simulation.html), **sourced**).
- **Arcweave**: branches with a mandatory `else`, scoped variables, `visits()`, a play-mode debugger; an erroring
  condition counts false ([docs](https://docs.arcweave.com/project-items/branches), **sourced**).
- **Dialogue System for Unity**: Lua `Conditions` and `Script` per entry, a runtime Lua console and watches
  ([manual](https://www.pixelcrushers.com/dialogue_system/manual2x/html/logic_and_lua.html), **sourced**).
  **Chat Mapper**: a failing condition evaluates as true and is logged, so content stays reachable
  ([docs](https://docs.chatmapper.com/game-developers/getting-started/), **sourced**).
- **ChoiceScript** (Choice of Games): Quicktest walks every option and both sides of every `*if` once; Randomtest
  plays 10,000 seeded runs and prints per-line hit counts; both must pass before publication
  ([official guide](https://choiceofgames.com/make-your-own-games/testing-choicescript-games-automatically), **sourced**).

## 2. Survey by theme

| Theme | What the field converged on | Evidence |
|---|---|---|
| **State model** | Named booleans and integers with a scope and a default; absent means default; computed flags for OR-logic and derived state; strict names so a variable can be found again | Larian scopes; BioWare 128 stored plus defined flags; CDPR `name → int`, absent is 0; Obsidian `n_`/`b_`; ZA/UM "tag it with a Boolean" |
| **Rules and events** | Event-driven rules are first-class only at Larian and in Bethesda's Story Manager; everyone else hooks scripts to dialogue enter and exit. The gotchas are shared: removals do not fire, an already-true state does not re-send, order is by name | Osiris; Story Manager "shares event" and throttles; Legion's PAS arbitration |
| **Choosing a line** | Three answers: hand-ordered first-match (Bethesda infos, CDPR), most-specific-wins over a pool (Valve, Yarn saliency), recency of the triggering state (Heaven's Vault); plus a negative check that retires a moot line | Valve; Yarn v3; Ingold |
| **Memory of what was said** | Visit counts as free state (ink, Twine, Arcweave); `speakonce`, `norepeat`, contexts with expiry (Valve); once-ever as the default persistence (Obsidian, inXile) | ink read counts; Valve groups; Pillars `OnceEver` |
| **Debuggers** | Thin everywhere. Best in class: CDPR's Quests Debugger (last save, live signals, continue from node, editable facts) and articy's simulation (per-journey overrides, failing sub-expression in red). Nobody shows "why did this fire" as a sentence | CDPR; articy; Norbyte's Osiris adapter; Bethesda `sqv` |
| **QA** | A random-walk bot that plays at speed and reports zero-hit content is universal at scale (Larian World Tester, Owlcat bots, Riot's BVS, ChoiceScript Randomtest, Ink-Tester); exhaustive branch walks where the language allows (Quicktest, Yarn Story Solver); human end-to-end plus a spreadsheet for endings; a staging quarantine before a new test may block anyone (Riot) | section 1 |
| **Localisation and voice** | A stable per-line ID stamped by a tool, required before export; a hash to flag changed source; voice assets keyed by ID with base-language fallback; a line sheet per character with context and gate; TTS placeholders by ID until recording | Yarn `#line:` and `lock`; Bethesda derived filenames and Export Dialogue; GoldFire TTS pipeline (**sourced**) |
| **Saves across patches** | Either keep IDs stable and migrate (Larian's dump-facts, swap-rules, reimport; CDPR deletion markers; SugarCube `saves.version`) or refuse and branch (Larian Early Access, Paradox). Order-based paths (ink) break; name-bound anchors survive. Deterministic input replays break on any content change unless stamped with a version | Larian versioning; CDPR; Inky 253; Supreme Commander desync account (**sourced**) |
| **Combinatorics** | Cut, converge and compress: bottlenecks (Ashwell's branch-and-bottleneck), aggregate state instead of path history (qualities, booleans, visit counts), selection over a pool instead of authored branching, front-loaded divergence (Tyranny's Conquest), "too complicated for the tool is too complicated for the game" (BioWare); Larian cut co-op dialogue outright | Ashwell; Short; Failbetter; BioWare |
| **Structure tooling** | Bethesda's scene phases with skip-on-failed-condition; Naughty Dog's state scripts; Inform 7's scenes with begins-when and ends-when and a SCENES log; Façade's beats with preconditions and a tension target | CK scenes (**secondary**); ND slides; [Inform](https://ganelson.github.io/inform-website/book/WI_10_3.html) (**sourced**) |

## 3. Lessons table

Layer: **E** engine (protocol, kernel, contract bump, reviewer), **C** compiler (schemas/source, `lib/loka/content`,
no protocol change), **L** lint (Elixir, baseline, reviewer as an engine-adjacent shared tool), **T** tools and
editor (`kernel/ts/play`, `tools/author-panel`, no reviewer). Cost S under a day, M a few days, L more.

| # | Lesson | Who | Loka today | Gap | Proposal | Layer | Cost | Value |
|---|---|---|---|---|---|---|---|---|
| 1 | A fact is a typed value with a default, a scope and no record until set | CDPR, Larian, BioWare | `FactSpec` bool, enum or bounded int with default; one scope, `player` or `instance` (`protocol/fact.schema.json:115`); `per_subject` (`:127`), `npc_pair` (`:131`); "an unset fact has its FactSpec default and no record" (`:186`) | none; Larian's dialog-local scope is the lowered `once` fact (`docs/system/cartridge.md:1018`) | keep | — | — | — |
| 2 | A computed flag: one named condition read in many places | BioWare defined flags, Osiris QRY, Yarn smart variables, Larian Script flags | A `when` is a tree of 26 leaves (`protocol/policy.schema.json:26-578`) written out at each site; `extends` copies definitions, not conditions | `~trusts you` (`fact_at_least` plus `not hostile`) is retyped at every gate and drifts | **K1** `conditions/<key>.json` in source; `{"op": "named", "key"}` inlined by the compiler; Trace lists its readers | C | S | M |
| 3 | Say it once; say it again only after a while | Valve `speakonce` and contexts with expiry, Obsidian once-ever, ink `*`, Hades cooldowns | Choices: `once`, `sitting` (`protocol/dialogue.schema.json:368`; lowering `cartridge.md:1018`); rooms: `visited_count` (`policy.schema.json:412`); time: `fact.stamp` and `time_since` (`step.schema.json:412`, `policy.schema.json:578`) | A reaction that should fire once or rest N seconds needs a declared fact, a `not`, an assign and `silent`, by hand, every time | **K2** `once: true` and `cooldown: <s>` on a reaction, lowered to those primitives | C | S | M |
| 4 | Rules run in a fixed order; last write wins; a failed guard leaves no trace | Osiris alphabetical goals | Rule-key order (`kernel/ts/src/mechanics/reaction.ts:103`); last write wins (`docs/system/mechanics.md:652-662`); a failed `when` returns `undefined` (`reaction.ts:154`) | none in the rule; the trace gap is row 10 | keep | — | — | — |
| 5 | Databases only defined or only checked are reported | Osiris orphan-query report | `orphan_facts {unused, write_only, read_only}` (`kernel/ts/play/reach.ts:112`); F1 table planned | none | keep | — | — | — |
| 6 | A threshold nothing can reach | Failbetter's parsimony; Sorcery!'s derived stat | `fact_at_least` (`policy.schema.json:563`) and `fact_compare` on int facts; `fact.adjust` amounts are literals (`step.schema.json:70`); the compiler checks type only | A gate at `~ >= 5` when every positive adjust sums to 3 can never open | **L2a** lint: for a bounded int fact, the sum of positive adjust amounts from the default below any compared value is a finding, unless a repeatable writer (a repeatable quest's exchange, a reaction on a repeating event) adjusts it | L | S | M |
| 7 | One quality, one meaning; every variable findable by name | Failbetter; ZA/UM naming; CDPR quest-code prefixes | `meaning` on a FactSpec, unread by rules (`fact.schema.json:135`); dotted names map to snake_case keys (`cartridge.md:11`) | A fact without `meaning` is legal; F1 cannot show what it is for | **L2c** lint: a fact without `meaning` (author-side nit; baseline absorbs today's) ; **W4** F1 shows `meaning` and the reachable range | L, T | XS | S |
| 8 | A conversation always has a way out | BioWare's unconditioned last line; Yarn's skipped group; Chat Mapper's failing condition counts true | A choice's `policy` hides it (`dialogue.schema.json:361`); a dialogue's own `policy` gates its offer (`:22`); nothing says a dialogue keeps one open choice | Every choice gated means a talk that opens with nothing to pick when all fail together | **L2b** lint warning: a dialogue whose every choice carries a `policy` (or `availability`) and none is `then: end` ungated | L | S | M |
| 9 | Play at random, at speed, and report what nothing reached | Larian World Tester, Owlcat bots, Riot BVS, ChoiceScript Randomtest, Ink-Tester | A seeded generator over GameView offers with shrinking (`kernel/ts/test/sim.ts:115`, `:169`; 1 to 64 steps, `:172`); a long-run purposeful policy for balance (`kernel/ts/play/flows.ts:39`); `marked()` probes which reaction fired (`kernel/ts/play/coverage.ts:17-36`); transcripts coverage (`coverage.ts:1-5`) | None of them runs over the prologue for story coverage, and a found fault is not kept as a checkpoint | **W1 roam**: `bin/loka roam <cartridge> --runs N --steps M --seed S`: `flows.ts`'s worker over a marked artifact, N seeded runs; prints zero-hit reactions, choices, quests, scenes, story points and per-node hit counts; an invariant failure or fault writes `checkpoints/roam-<seed>.json` after `sim.ts`'s shrink, so the bug is a replayable path from then on | T | M | H |
| 10 | See why a rule fired, live | CDPR Quests Debugger, articy's red sub-expression, Osiris debugger | `POST /why` replays a marked copy (`kernel/ts/play/why.ts:1-4`); D1 per step within a budget (decided) | The kernel records no firing; exact live answers cost a replay | **E2** later: a dev-only `rules` record on the decision; section 5 | E | M/L | M |
| 11 | Continue from any node against the last save | CDPR | Checkpoints and jump (`kernel/ts/play/live.ts:91`); `dev_go_to_room`, `dev_set_fact` recorded as steps; story map's "play from a node" planned | none for Part 1 | keep | — | — | — |
| 12 | A rename must not break recorded paths | ink paths by order (Inky 253), CDPR deletion markers, Larian goals matched by name | A checkpoint is `{steps: [{intent} | {advance}]}` (`mobile/app/author/place.ts:7`) naming keys and ids; a renamed room fails its checkpoint at the step (R1's test) | The editor knows the rename and lets the path rot | **W2**: the `/restructure` route rewrites every checkpoint's steps that name the renamed key, in the same write, and reports the count | T | S | M |
| 13 | A new test is quarantined before it may block anyone | Riot BVS | A new checkpoint fails CI on its first flaky roll; a chance roll that flips is a known limit | A flaky path blocks a merge | later: `checkpoints/draft/` replays and reports but does not fail `check` | T | XS | S |
| 14 | A line has a stable ID, a hash that flags edits, and a sheet per speaker | Yarn `#line:` and `lock`, Bethesda Export Dialogue, GoldFire TTS by ID | `Text` is `{key, bindings}` (`cartridge.md:878`); inline prose lowers to `<kind>.<key>.<path>`, stable by position not by content (`cartridge.md:420-424`); `text.json` is the catalog; localisation rows deferred (`docs/system/owner-rules.md:60`) | No one sheet of every line with speaker, source line and gate; needed first for proofreading, later for voice and loc | **W3** `bin/loka lines <cartridge> [--speaker k]`: key, words, speaker or owner node, `file:line`, the gate in explainer words, `~` flag; CSV and JSON | T | S | M |
| 15 | A scene page that depends on state | Bethesda scene phases skip on a failed start condition; Disco's micro-reactivity | A modal scene is narrate pages, `await_ack`, `end` (`protocol/scene.schema.json:252-296`); `narrate` has `text` only; a cutscene that remembers needs two scenes and two trigger outcomes | One remembered detail doubles the cutscene | **E1** `when?` on a modal `narrate` step (skip the page when it fails); section 5 | E | M | H |
| 16 | Conditions are data on the edge, in one format everywhere | Bethesda CTDA rows; articy pins | One `Policy` type on choices, offers, variants, ambient sets, reactions, quests, dispositions | none | keep | — | — | — |
| 17 | Bind runtime things to slots | Bethesda aliases; dialogue roles | Dialogue `roles` bound at open (`dialogue.schema.json:28`); reactions filter by definition (`reaction.schema.json:13-258`); populations | none for authored content; Radiant-style fill is rejected ([innovations §4.3](rpg-genre-innovations-2026-11-04.md#43-generated-quests-skyrims-radiant-story-a-caution)) | keep | — | — | — |
| 18 | Arbitrate competing starts; throttle | Story Manager shares-event and max concurrent; Legion PAS | Every matching reaction fires; scenes start on their trigger (`lib/loka/content/scenes.ex:140-147`) | none visible for one author's rule counts | reject until a cartridge shows two scenes fighting for one moment | — | — | — |
| 19 | Most-specific-wins or recency instead of hand order | Valve, Yarn saliency, Heaven's Vault | First holding set wins (`protocol/entity.schema.json:1620`); shadowing lint for variants (`lib/loka/content/lint.ex:116-133`), for ambient sets in L1 | hand order is fine at Part 1's counts | later: a compile-time `order: specific_first` that sorts sets by guard term count; no engine change | C | S | S |
| 20 | Retire a moot line with a negative check | Heaven's Vault redundancy condition | `not` in any `when` | none | keep | — | — | — |
| 21 | State over branches; compress many flags into a few scoped numbers | Ashwell, Short, Alpha Protocol, Obsidian factions | Bounded ints with `fact.adjust`; standing and disposition (`cartridge.md:1420`); quest `faction` and `contribution` facts | design practice, not tooling; F1 and C1 show it | keep; W4 adds the reachable range so compression is visible | — | — | — |
| 22 | Delayed consequence | Short; CDPR; Disco's thoughts internalising over days | `after` reactions (`reaction.schema.json:529`; `cartridge.md:1527`), `fact.stamp`, `time_since` | none | keep | — | — | — |
| 23 | Storylets as content | Failbetter, Weather Factory | Retired (`docs/system/mechanics.md:3455`): an opportunity is an action on a page | none | keep | — | — | — |
| 24 | Checks with generated success and failure branches | Torment Perform Task; BG3 rolls | `check` on a choice, `then`, `then_failed` (`dialogue.schema.json:358`, `:371-374`); passive voices by `skill_compare` (`cartridge.md:1386`) | none | keep | — | — | — |
| 25 | A save survives a content patch | Larian story patching, CDPR markers, SugarCube versions | Pre-production: a save opens only under its exact content hash and kernel_api, else Start over (`docs/system/save.md:19-21`, `:80-81`); the Realm plan is [live ops](realm-live-ops-2026-10-29.md) | v1 on the phone needs a stated policy | owner question 4; no machinery now | — | — | — |
| 26 | Desync detection between two implementations | RTS state hashing | Two kernels at golden parity on fixtures and randomized differentials (`docs/system/architecture.md:117`, `:147-150`); state hashes per step in `sim.ts` | none | keep | — | — | — |
| 27 | An expected path per task, then search for deviations | ZA/UM, Larian's endings sheet, Until Dawn | `outline.json` beats with seeds and payoffs; checkpoints as the expected paths; R2 chips show which nodes none reaches | none beyond R2 | keep | — | — | — |
| 28 | Export the whole fact state as a setup script | Twine "copy all as one `(set:)`" | A checkpoint records steps, not state; `dev_set_fact` exists | a long checkpoint could be compacted to cheats for fact-only beats | later, if D1's budget bites: `compact` writes `dev_set_fact` steps for facts and keeps the rest | T | S | S |
| 29 | Localised and voiced lines multiply per branch; forbid lines that name generated traits | ZA/UM 428 cards; Legion personas | One author, one language, no voice; `~` placeholders count words (`GET /todo`) | none now | W3 is the on-ramp when voice or a second language comes | — | — | — |
| 30 | Edge cases: reward, do not block | Larian (Kostov); BG3 lessons | the n+1 rule is in the [BG3 lessons](baldurs-gate-3-lessons-2026-11-04.md) | — | W1's zero-hit list is where the unrewarded edge shows | — | — | — |

## 4. Proposals, ranked in tiers

### Now (prologue Part 1)

1. **R1** checkpoints after each compile (decided; unchanged).
2. **W1 roam.** Why now: the owner is about to write branching beats; a random player that reports what nothing
   reached is the one QA tool every studio in section 1 built, and Loka has all three parts. Reuses `flows.ts`'s
   worker loop (it already plays many seeds over game hours), `coverage.ts`'s `marked()` and `sim.ts`'s shrink. No
   kernel change: the marker is a `narrate` step appended to a copy. Output is a report plus a checkpoint per
   failure, which R1 then guards forever. Acceptance: a planted cartridge with a reaction only a rare choice reaches
   lists it zero-hit at 20 runs and hit at 500; a planted invariant break writes `checkpoints/roam-<seed>.json`
   whose `bin/loka check` fails at the same step; the showcase at 50 runs × 300 steps finishes under two minutes
   on the M1 (measured, kept if it fails).
3. **D1** step panel (decided).
4. **K2 `once` and `cooldown` on reactions.** Why now: the first "the game remembers, and says so" lines are
   one-shot reactions; today each costs a fact in `facts.json`, a `not fact_compare` in `when`, a `fact.assign` and
   `"silent": true`. The compiler already lowers a choice's `once` the same way (`cartridge.md:1018`), so this is the
   same lowering at a second site: `once` adds the engine bool fact `<rule>_done` and the two pieces; `cooldown: N`
   adds an int fact `<rule>_at` with `fact.stamp` and `time_since {at_least: N}`. An authored fact of either name is
   `RESERVED_FACT`, as for tips. Source schema only; the artifact is unchanged, so no protocol or kernel change and
   no reviewer. Acceptance: a planted rule with `once` fires on the first matching event and not the second in a
   checkpoint; with `cooldown: 60` it fires, is silent at +30 s and fires at +61 s; lint sees the lowered assign as
   silent.
5. **C1** consequence preview (decided).
6. **L1** story lints (decided) **plus L2a, L2b, L2c** in the same Elixir slice: threshold never reachable; a
   dialogue with no fallback choice (warning); a fact without `meaning`. Each definite from the source; the baseline
   absorbs today's findings. One reviewer for the slice.
7. **W2 rename rewrites checkpoints.** With the `/restructure` route another session is building: when a key is
   renamed, every `checkpoints/*.json` step whose intent names it is rewritten in the same write, and the response
   reports `checkpoints: n`. Doc only here; the route's owner adds it or a follow-up slice does. Acceptance: rename a
   room a checkpoint walks into; `bin/loka check` stays `ok`.
8. **F1** facts table (decided) **plus W4**: columns `meaning` and the reachable range (default, sum of negative
   adjusts, sum of positive adjusts, clipped to the bounds; "∞" when a repeatable writer adjusts it).
9. **R2** coverage chips (decided). W1's hit counts can feed the same chips later (a node with a checkpoint
   *and* a roam count).
10. **K1 named conditions.** Tier: before v1 by default; now if Part 1's second area repeats a gate. Source
    `conditions/<key>.json` holds one Policy; a `{"op": "named", "key": "<k>"}` leaf anywhere a Policy is written
    is replaced by the compiler with that Policy (recursion refused, `CONDITION_CYCLE`); the Story map shows the
    condition as a node with readers; the Trace answers `where is ~trusts_you read`. The artifact never carries the
    leaf, so no protocol or kernel change, no reviewer. Acceptance: two sites name the condition; the compiled
    artifact is byte-identical to the hand-inlined one; a cycle is refused at the file.

### Before v1

- **E1 conditional scene page** (section 5). Owner question 2.
- **W3 lines sheet.** `bin/loka lines`: one row per text key with speaker or owning node, source `file:line`,
  gate in explainer words, `~` flag, byte length; CSV and JSON; `--speaker` filter. First use is proofreading
  (Ziets read every line of his zone; the owner reads every line of an area in order); later the voice and
  localisation on-ramp, where Yarn's `lock` hash becomes a column.
- **K1** if not pulled forward.
- **Draft checkpoints** (row 13): `checkpoints/draft/` replays and reports, never fails `check`.

### Later

- **E2 rule trace on the decision** (section 5), only if D1's budget notice is hit in practice (owner decision
  2026-11-07: budget first).
- **Compile-time `specific_first` ordering** for ambient sets and variants (row 19), when a room has more sets than
  the owner wants to order by hand.
- **Checkpoint compaction** to `dev_set_fact` steps (row 28), only if D1's per-step replay gets slow on Part 1's
  real paths.
- **Telemetry on reactions** (Sawyer's "how often did NPCs react to this variable"): the story point reports and the
  observation table are the hooks; nothing before the Realm.

### Rejected, with why

- **Event arbitration and throttles** (Story Manager's shares-event and max-concurrent, Legion's PAS): built for
  dozens of systems competing for one moment; Loka's reactions all fire in rule-key order, scenes start on their
  trigger, and no cartridge has shown two starts fighting. Revisit when one does.
- **A salience scorer in the kernel** (Valve, Yarn v3): a mechanic and a parity obligation to replace hand order at
  counts of three to five sets per room. The compile-time sort (row 19) gives most of it later with no kernel work.
- **Model checking or a theorem-prover soft-lock check** (Yarn Story Solver, the Petri-net papers): the state space
  includes the clock, NPC schedules and populations; W1's random walk plus the story map's definite lints are the
  practical version.
- **Save migration machinery now** (Larian's dump-swap-reimport, SugarCube versions): pre-production keeps no
  save compatibility by owner decision; the Realm has its [live-ops plan](realm-live-ops-2026-10-29.md). The v1
  phone policy is owner question 4, not a slice.
- **Radiant-style alias filling and generated quests**: already cautioned against in the [innovations note](rpg-genre-innovations-2026-11-04.md#43-generated-quests-skyrims-radiant-story-a-caution); Nesmith's own account confirms it.
- **A `weather.set` step** and **choices inside modal scenes**: decided 2026-11-07 (fact for Part 1; branch through
  `.scene` dialogues). E1 is a different ask (a conditional page, not a choice) and is listed as a question.
- **An authored response-rules file or a Lua console**: the owner rule against a custom authoring language stands
  (`owner-rules.md:117`); K1 and K2 are compile-time shortcuts lowered to today's cartridge, which that rule allows.

## 5. Engine proposals: contract, parity, reviewer

Both touch `protocol/`, so both are engine changes under the [lean default](../WORKFLOW.md#lean-default): Opus
designs, one fresh reviewer, a `docs/reviews` record (a schema or `kernel_api` change with none is refused at
merge, [CHECKS](../CHECKS.md)), a fixture that fails when each new bound is removed ([contract lessons](../lessons/contracts.md)),
and `bin/contracts.exs --check` regenerated.

### E1: a conditional page in a modal scene

| Ruling | Why | Test |
|---|---|---|
| **`when?: Policy` on a modal scene's `narrate` step** (`protocol/scene.schema.json:252-260`); the sequencer skips a page whose `when` fails and continues to the next step; `await_ack` and `end` take no `when`; the dream scene is unchanged | The smallest grammar that lets one cutscene remember one fact (Disco's rule: tag the moment, check it everywhere); Bethesda's phases do exactly this | A scene of three pages, the second gated on `~f == true`: with `f` false the player acks two pages, with `f` true three; `scene_ended` and `on_end` identical in both |
| **Evaluated when the page is reached, for the scene's actor, on the proposal world** (as a reaction's `when`, `reaction.ts:154`) | One rule for every `when` in the engine; a fact set by an earlier reaction in the same command is seen | A reaction on the scene's start sets `f`; the gated page shows |
| **`.cut` grammar**: a page line may be preceded by `when: <fact>` or `when: not <fact>` (bool facts only, as `.scene`'s `needs:`, `cartridge.md:1015`); the Scene card gets a `when` field per page | Same words the owner already writes in `.scene` | A `.cut` with `when:` lowers to the JSON; `FACT_TYPE_MISMATCH` for a non-bool |
| **Lint**: a scene whose every page is gated is a finding (nothing may show) | The fallback rule | planted scene, one row |

Contract and parity: `SceneStep` changes (`scene.schema.json`), so `kernel_api` bumps (`kernel/ts/src/runtime/world.ts:110`),
every save pin refuses with Start over (`save.md:19-21`), and `protocol/fixtures/cartridge_scene_hash.json` is
regenerated; a scene fixture gains the gated case. scene@1 is TypeScript-only (`docs/features.gen.md:34`), so no
Elixir twin and no differential; Elixir validates the schema change through `bin/contracts.exs`. Kernel:
`kernel/ts/src/mechanics/scene/` (the sequencer), `kernel/ts/src/content/cartridge_scenes.ts`, the compiler
`lib/loka/content/scenes.ex` and `cut_files.ex`, the Scene card. Reviewer: yes. Cost M. Budget: each `when`
evaluation adds policy leaves to the step budget as a reaction's does.

### E2: a rule trace on the decision (later)

| Option | Shape | Contract impact | Verdict |
|---|---|---|---|
| (a) A new event `reaction_fired {rule}` | joins the committed events, receipts and the trace | `event.schema.json`, `kernel_api` bump; every hash fixture of a cartridge with reactions changes; events are player-visible state in the trace | no: the trace is authority-adjacent, and a dev artefact in it is noise |
| (b) A dev-only `rules?: [{rule, matched, fired, failed_leaf?}]` on the Decision, produced by `proposal.ts` only when the host sets `dev`, never hashed, never saved | `decision.schema.json` optional field; `kernel_api` bump; hash fixtures unchanged if the field is excluded from the canonical hash the way narration variety is applied after | the honest exact source for D1; M; reviewer | later, if the budget bites |
| (c) Host-side evaluation of `triggered()` and `holds()` on the in-memory pre-state | no contract change | approximate: a rule's `when` reads earlier rules' writes in the same command (`mechanics.md:652-662`) | no: a debugger that is sometimes wrong is worse than a slow one |

Owner decision 2026-11-07 keeps D1 on the replay within a budget; (b) is recorded so the next person does not
re-derive it.

## 6. Changes to `docs/design/story-tooling.md`

- §6 marked decided (owner 2026-11-07, paraphrased: yes to each recommendation).
- New rulings for W1, K2, W2, L2, K1, W3 and E1 in the same Why and Test form, and a second build table for the
  survey's slices with acceptance, after the decided six. The decided order is not changed; question 1 below asks
  whether W1 and K2 join it.

## 7. Owner questions

**Owner 2026-11-07 (paraphrased): yes to each recommendation below.** Decided: W1 goes after R1 and K2 after D1;
E1 stays before v1, pulled forward only when a beat asks for it (a second scene per branch until then); L2b is a
warning; the v1 save policy is decided at the release-candidate audit; roam reports only until Part 1 is written,
then gates with a baseline. The questions stay below as the record.

1. **Reopen the order?** The decided order R1, D1, C1, L1, F1, R2 stands. The survey's evidence (every shipping
   studio runs a random player; a one-shot reaction is the first reactive line the owner will write) argues for
   R1, **W1**, D1, **K2**, C1, L1 + L2, W2, F1 + W4, R2, K1. Accept the insertion, or keep the six and queue W1 and
   K2 after them?
2. **A conditional cutscene page (E1).** Engine change, reviewer, contract bump, Start over for preview saves.
   Does a Part 1 beat need one cutscene to remember one fact, or is a second scene per branch acceptable until
   v1? Recommend: before v1, pulled forward only when a beat asks for it.
3. **Lint severity for L2b** (a dialogue with no ungated choice): warning in the baseline, or a definite finding
   that fails `mix loka.lint`? Recommend warning: a fully gated talk can be deliberate.
4. **Save policy for v1 on the phone.** Pre-production refuses any other content hash with Start over. For the
   first shipped chapter, when a patch fixes a line: (a) Larian's shape, facts and quest rows survive a swap of
   same-key content (the Realm live-ops design already assumes it); (b) Start over per content release, stated in
   the store text; (c) decide at the release-candidate audit. Recommend (c), with W1 and R1 as the evidence base.
5. **Roam's place in CI.** Report only (like `coverage.ts`), or a gate that fails when a reaction, choice or scene
   is zero-hit across N runs? Recommend report only until Part 1 is written, then a gate with a baseline like lint's.

## Known limits and not checked

- Every ck.uesp.net and Valve wiki fact rests on search snippets; both sites refused fetches. GDC talk bodies are
  members-only; abstracts and press write-ups stand in. Items marked **unverified** are not cited in section 3.
- Not read: the Hades Lua table semantics, Owlcat's etude internals, any first-hand BioWare, Obsidian or CDPR
  localisation and voice pipeline, Rockstar's mission tooling.
- Not measured: W1's runtime on the showcase (the acceptance row measures it); whether `flows.ts`'s worker reaches
  dialogue choices or only verbs (if not, W1 adds the choice step to the worker, still inside `play/`).
- Not checked: whether the `/restructure` route in flight already touches `checkpoints/` (W2 assumes not); whether
  the dream scene's sequencer shares code with the modal one (E1's cost assumes it does).
