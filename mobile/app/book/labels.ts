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
  inside: 'Inside',
  held: 'Held',
  worn: 'Worn',
  where: 'Where',
} as const;
