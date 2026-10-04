# Next UI polish owner instructions

Exact owner messages:

> Why after taking the brass lantern the words in every room is fuzzy?  Also after accepting brams quest in the dialogue pane, there should be an event like 'Journal updated' or something in italics or something diferent to show that its not the dialogue but an event, and make that inside of the dialogue pane.  Also there's a 'close' and 'leave' option when talking to bram, just make it 'leave'. no need close.  Why are there both?  Also no need for a detail pane for the position status.  When clicking on the position in the status bar, just cycle through each position right then and there without going into a detail pane.

> Also when we go into Brams detail page, he should also have a description.  All items npcs and players should have a description.  Also move the talk and leave and whatever options up and not down at the bottom, and as the dialogue flows the options stay at the bottom of the dialogue event log

PM implementation choices pending adoption in full brief: italic neutral Journal updated in chronological NPC log after confirmed actual journal change; single Leave closes matching offered choice and returns World only after confirmation, else local navigation, silent generic close; direct position cycling standing/sitting/resting/sleeping through offered legal actions with captured token; authored NPC description before actions; action row directly after description initially and after newest dialogue-log entry as conversation grows, superseding fixed viewport-bottom dock. All existing item descriptions preserved; player descriptions normative when real players projected, no invented presence. Fuzz remains diagnosed candidate, no invented cause/unsupported native prop. Source proof screenshots already body-blurred at revision0 before Take; preserve exact owner timing as report. Current owneractivelyplayingnew665/0.0.2preview; no GUI/save/lifecycle/reset operations.

## PM adoption

The PM adopted the presentation choices above for this new polish round. The
[canonical Book UI](../system/book-ui.md) states their current behavior. Description
rendering waits for the separately coordinated real GameView projection amendment;
the remaining UI work proceeds independently. Native blur proof remains required
after a fresh build, with the owner preview untouched during implementation.
