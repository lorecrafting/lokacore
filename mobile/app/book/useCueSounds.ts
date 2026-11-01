// What the Book plays: the cues of each view, and the sound of the room it is in.
import { useEffect, useRef } from 'react';
import { useCues } from './cues.ts';
import { hearCues, playRiffle, playTurn } from './cueSounds.ts';
import { useReducedMotion } from './fade.ts';
import type { presenter } from './presenter.ts';
import { ambience } from './sound';

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;

export function useCueSounds(s: Screen, turn: number, resumes?: number, riffle?: boolean) {
  useEffect(hearCues, []); // before useCues: heard from its first cue
  const place = s.view.place;
  const weather = s.view.calendar_status?.weather;
  const chapter = s.view.chapter?.index;
  const read = useRef(chapter);
  // Every view, not only a changed tag: a death cuts the room, and the next view brings it back.
  // This runs before useCues, so a fight or a new chapter's music has not started: no piece, none spent.
  useEffect(() => {
    const theme = chapter !== undefined && chapter !== read.current;
    read.current = chapter;
    ambience(place?.sound, weather, !!place?.exposed, !!s.view.combat || theme);
  }, [s.view]); // eslint-disable-line react-hooks/exhaustive-deps
  const reduced = useReducedMotion();
  useCues(
    s.view,
    s.catchingUp,
    turn,
    resumes,
    reduced,
    riffle ? playRiffle : playTurn,
    s.died,
    s.deed,
  );
}
