// The boundary between the renderer and a game engine (spec 07 "The session boundary"): the renderer
// reads host-neutral GameView data and sends host-neutral intents through these types. It names no
// engine internals (no Db, Story, World or Cartridge), so the local TypeScript authority and a
// future online Elixir Realm can both serve one presenter. The renderer's words live in the app.
import type {
  ActionInput,
  ActionInvocation,
  DecisionResult,
  EntityId,
  ErrorCode,
  GameView,
  Key,
  NarrationRecord,
} from '../../../kernel/ts/src/contracts.gen.ts';

export type {
  ActionInput,
  ActionInvocation,
  DecisionResult,
  EntityId,
  ErrorCode,
  GameView,
  Key,
  NarrationRecord,
};

/** What a press sends: an invocation without its id and actor, which the session adds. */
export type Intent = Omit<ActionInvocation, 'invocation_id' | 'actor_id'>;

/** The answer to one press (03 §14, 04 §16). */
export type Reply =
  | { kind: 'saved'; decision: DecisionResult }
  | { kind: 'stale_view' } // sent against an older view; nothing changed
  | { kind: 'conflict' }
  | { kind: 'invalid' | 'unauthorized' }
  | { kind: 'pending' } // the save is not confirmed: any later invoke resends the same attempt
  | { kind: 'fault'; code: ErrorCode };

/** One game being played. */
export interface Game {
  /** The current page and its freshness token (04 §16). */
  view(): { view: GameView; token: string };
  /** Throws when the write failed: the attempt stays pending and the next call resends it. */
  invoke(intent: Intent): Reply;
  pending(): boolean;
  /** Cartridge prose (content, not app words); none for an unknown key. */
  text(key: string): string | undefined;
  /** The last committed narration, to show again on a reopen (06 §43). */
  lastNarration(): NarrationRecord | undefined;
}

/**
 * Why there is no game: the save's kind (none: untyped), its message, a `code` for a start over
 * that is not confirmed (the presenter says it in words), and whether Start over is offered.
 */
export type Failed = {
  kind?: 'unsupported_save_format' | 'save_corrupt' | 'pinned_release_missing';
  message: string;
  code?: 'start_over_pending';
  startOver: boolean;
};

export interface GameSession {
  game(): Game | undefined;
  failed(): Failed | undefined;
  /** A start over that failed and kept the game: its message, for the presenter's log. */
  startOver(): string | undefined;
}
