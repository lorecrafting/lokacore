# Polish tour (2026-10-23)

Story ids are computed from title and export (`sanitize(title)--kebab(export)`). Open each one as `?path=/story/<id>`.
Before you file anything new, check the "Known" line for that screen.

## Fixed today (merged #447, #451, #452, #453; check them, do not refile)
x6t.17 refused lines tagged with a reason, x6t.18 one card per offer, x6t.19 + x6t.96 detail history per visit, x6t.20 Apply / Wield words, x6t.21 authored Leave dropped, x6t.22 position tap line, x6t.23 Leave returns to its page, x6t.24 teaching line, x6t.25 Try again on the other-tab lock, x6t.30 "Aldous is too stunned to do anything.", x6t.36 dark rooms, x6t.37 room status lines, x6t.38 cursed item refusal, x6t.43 live regions, x6t.68 + x6t.94 item foot is Leave only, x6t.80 refusal note dedupe, x6t.81 smoke findings, x6t.95 "requires Blade. Aldous teaches it in the drill yard.", x6t.10 dream closes the conversation first, loka-7s0, loka-ozu, loka-oej, loka-on6.

## Known and filed (do not refile)
x6t.26 death outside combat (waits on engine loka-3w3q), x6t.29 "1 doses" (waits on loka-6qi plurals), x6t.98 lock check Chrome-only, x6t.99 signpost wording / Word bar height, x6t.100 map does not re-scroll, x6t.101 identical notices collapse, x6t.102 Leave while close pending, x6t.103 swept lines (designer), x6t.104 dream closes a one-shot offer silently, loka-g96 paragraphs outside rooms, loka-6qi plurals and "the".

## 1. World page (seen most)
- pages-room--first-room, --reworded, --npcs-and-items, --long-log, --refusal-line, --at-night, --sense-cues, --sense-cues-here, --asides, --companion-remark
- Look at: prose rhythm, entity lines, the log tail, night tint, aside spacing.
- Known: loka-6qi (plurals and "the"), loka-g96 (paragraphs outside rooms; deferred), x6t.71 (room line variants not drawn, unlabelled), x6t.6 (stars only outdoors), x6t.7 (lamp glow), x6t.99, x6t.100.

## 2. Status line and icons
- book-statusline--plain, --dusk, --weather, --sky, --warning-hp, --danger-hp, --bleeding, --conditions, --pennies, --only-pennies, --locked, --pending, --narrow, --one-line-larger, --wraps-at-max, --position
- book-statusicon--buff, --debuff, --neutral, --permanent, --five, --overflow, --held, --locked, --focused, --ring-full, --ring-eighty, --ring-near-empty, --ring-empty, --ring-permanent, --ring-draining, --ring-draining-past-six
- Look at: fit on one line at phone width, ring legibility, overflow count.
- Known: x6t.88 (story checks: 328 px, third line, truncation), x6t.66 (icon follow-ups), x6t.63 (icon set), loka-15g and loka-kgd.7 (condition cap and short form).

## 3. Action cards, verbs, entity lines
- book-actioncard--short, --two-line-label, --list-of-six, --with-unavailable-note
- book-verbline--one, --three-in-a-room, --with-refused
- book-entityline--npc-with-carried-note, --item, --held, --worn, --inside, --notice-with-remaining-count, --contents-row, --run
- Look at: label wrap, the unavailable "label: reason" form, note placement.
- Known: x6t.67 (homestead verbs read like container moves; x6t.54 merged into it).

## 4. Logs
- book-loglines--narration, --system-line, --refused-with-tag, --thirty-lines, --empty
- Look at: how narration, system lines and refused lines differ; scroll at 30 lines.
- Known: loka-4l3 (refusal tag on native), x6t.29 (resting exit says "not now", "1 doses", "2-2 damage").

## 5. NPC page
- pages-npc--choice, --shop, --services, --closed-conversation
- Look at: choice cards, shop rows, the Leave control.
- Known: x6t.70 (NPC conditions), x6t.14 (wording M4/M5).

## 6. Item page
- pages-item--plain, --container-with-inside, --fuel, --too-heavy
- Look at: action order, fuel line, the too-heavy refusal.
- Known: x6t.57 (Contents row summaries).

## 7. Combat
- pages-combat--one-foe, --pack, --bleeding
- Look at: foe lines, round log, bleeding cue.
- Known: x6t.69 (spell chips in a fight), loka-6qi (pack plurals), x6t.26 (death outside combat lines).

## 8. Sections: Character, Journal, Carrying, Settings
- pages-sections--journal, --carrying-empty, --carrying-held, --character-unknown, --character-full, --character-points-to-spend, --contents, --settings, --journal-lore, --journal-lore-away, --journal-lore-refused, --journal-chronicle, --journal-chronicle-days, --ancestry
- book-chip--available, --unavailable, --pending, --chosen, --reading-size-row
- Look at: section headings, empty states, chip states in Settings.
- Known: x6t.56 (lore shown twice on Character), x6t.57.

## 9. Word bar and away recap
- book-wordbar--rows, --cast-with-refused-word, --field-open, --bad-word-note
- book-awayrecap--collapsed, --open, --milestone
- Look at: row density, the bad-word note.
- Known: none filed.

## 10. Map and notices
- pages-map--discovered-two-levels, --barred-exits, --where
- pages-notices--notice-with-read, --dream-available, --dream-acknowledged
- Known: x6t.100 (map does not re-scroll), x6t.101 (identical notices collapse).

## 11. Chapter, scene, recovery
- pages-chapter-and-scene--chapter-title-long, --scene, --dream
- book-continuebutton--chapter, --scene
- pages-recovery--save-error-release, --save-error-format, --save-error-corrupt, --save-error-locked, --fault, --pending, --catching-up
- Known: none open.

## 12. Frame: page, foot, footer, control, note, tip
- book-page--with-running-head, --long-running-head, --no-running-head, --with-section-headings, --centred, --long-title, --fixed-title, --no-title, --scroll-to-end, --with-foot
- book-pagefoot--one-return, --two-returns
- book-footer--rest, --held, --tip, --barred-exit, --up-and-down
- book-control--start-over, --back-to-world, --disabled, --leave, --back-to-board, --back-to-map, --close, --resume-dream, --continue-conversation
- book-note--empty-state, --save-not-confirmed; book-tip--shown
- Known: loka-6qi split item (running head with several quests).

## 13. Riddle, night sky, page turn
- book-lettertile-riddle--full-bank, --answer-in-progress; book-lettertile--free, --used
- book-nightsky--night; book-pageturn--chapter-to-settings
- Known: loka-v2j (curl skipped when the page picture takes over 160 ms).

## 14. Live (real engine, use these for the rulings with no story)
- live--reeve-errand, --reeve-asked, --nell-shop, --sack-contents, --goblin-combat, --loft-map, --night-inn
- Look at: the same screens with real content.

## 15. Tokens
- docs-tokens--palette-swatches, --type-styles, --space-size-radius, --motion-and-sound
- Known: x6t.89 (the Specs.mdx file list duplicates the catalogue test list).
