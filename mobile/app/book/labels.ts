// The Book's own control and section words (docs/BOOK-UI-COMPONENTS.md, Control and Page rows):
// the same in every cartridge, so not text keys, and not kernel codes (words.ts). Components, e2e
// tests, the walkthrough and story routes all name a control through this table; it imports
// nothing, so the e2e runner can load it. lint/rules/mobile-book-labels.yml lists these words too.
export const LABEL = {
  leave: 'Leave',
  leaveConversation: 'Leave the conversation',
  backToWorld: 'Back to World',
  backToBoard: 'Back to board',
  backToContainer: 'Back to container',
  backToMap: 'Back to map',
  close: 'Close',
  resumeDream: 'Resume dream',
  continueConversation: 'Continue conversation',
  gotIt: 'Got it',
  startOver: 'Start over',
  backspace: 'Backspace',
  clear: 'Clear',
  submit: 'Submit',
  // The Start over confirmation (App.tsx).
  startOverAsk: 'Start over?',
  startOverLoses: 'Your saved game will be lost.',
  cancel: 'Cancel',
  inside: 'Inside',
  held: 'Held',
  worn: 'Worn',
  where: 'Where',
  askWhere: 'Ask where',
  // Before a topic's authored label on an NPC's card (row FD7).
  askAbout: 'Ask about',
  lore: 'Lore',
  notHere: 'Not here',
  // The away recap's heading (toolbox row W27; wording pending designer, loka-x6t.14).
  awayRecap: 'While you were away',
  // The World page's Word block (word bar S3): its title, row titles and keyboard.
  word: 'Word',
  say: 'Say',
  whisperTo: 'Whisper to',
  shout: 'Shout',
  cast: 'Cast',
  typeAWord: 'Type a word',
  aWord: 'A word',
  oneWord: 'One word, letters only.',
} as const;
