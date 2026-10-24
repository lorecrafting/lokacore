// The Book's own control and section words (Control's and Page's doc comments):
// the same in every cartridge, so not text keys, and not kernel codes (words.ts). Components, e2e
// tests, the walkthrough and story routes all name a control through this table; it imports
// nothing, so the e2e runner can load it. lint/rules/mobile-book-labels.yml lists these words too.
export const LABEL = {
  leave: 'Leave',
  leaveConversation: 'Leave the conversation',
  backToWorld: 'Back to World',
  backToBoard: 'Back to board',
  backToMap: 'Back to map',
  close: 'Close',
  resumeDream: 'Resume dream',
  continueConversation: 'Continue conversation',
  gotIt: 'Got it',
  startOver: 'Start over',
  tryAgain: 'Try again',
  backspace: 'Backspace',
  clear: 'Clear',
  submit: 'Submit',
  // The Start over confirmation (App.tsx).
  startOverAsk: 'Start over?',
  startOverLoses: 'Your saved game will be lost.',
  cancel: 'Cancel',
  inside: 'Inside',
  held: 'Held',
  // Take, on an item a living NPC holds (pass-1 E14).
  lift: 'Lift',
  worn: 'Worn',
  where: 'Where',
  askWhere: 'Ask where',
  // Before a topic's authored label on an NPC's card (row FD7).
  askAbout: 'Ask about',
  lore: 'Lore',
  // The Journal's Chronicle and its day headings (toolbox row FD6; wording pending designer).
  chronicle: 'Chronicle',
  day: 'Day',
  notHere: 'Not here',
  // The away recap's heading (toolbox row W27; wording pending designer, loka-x6t.14).
  awayRecap: 'While you were away',
  // The say field's sends, the status line's say icon and field; the Character page's Spells.
  say: 'Say',
  whisper: 'Whisper',
  shout: 'Shout',
  cast: 'Cast',
  sayToRoom: 'Say to the room',
  aWord: 'A word',
  oneWord: 'One word, letters only.',
  spells: 'Spells',
  // The Contents section of held and worn things (owner 2026-10-15, loka-x6t.55).
  inventory: 'Inventory',
  // The Reading size setting (docs/system/book-ui.md#world-and-status-entry, loka-x6t.42).
  readingSize: 'Reading size',
  readingStandard: 'Standard',
  readingLarge: 'Large',
  readingLarger: 'Larger',
  // The Pick list options (book-ui.md, Pick a second thing; owner 2026-10-23).
  useAnItem: 'Use an item…',
  useOn: 'Use on…',
  giveAnItem: 'Give an item…',
  giveTo: 'Give to…',
  // A foe's definite article on the Combat page, "the goblin" (loka-6qi).
  the: 'the',
} as const;

// A collapsed group's count in the room sentence, "two crows", from two; digits from 10 (loka-6qi).
export const COUNT: readonly string[] = [
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
];
