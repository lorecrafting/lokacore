// What the Book plays: the cues of each view, and the sound of the room it is in.
import { useEffect } from 'react';
import { useCues } from './cues.ts';
import { hearCues, playTurn } from './cueSounds.ts';
import { useReducedMotion } from './fade.ts';
import type { presenter } from './presenter.ts';
import { ambience } from './sound';

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;

export function useCueSounds(s: Screen, turn: number, resumes?: number) {
  useEffect(hearCues, []); // before useCues: heard from its first cue
  const place = s.view.place;
  const weather = s.view.calendar_status?.weather;
  // Every view, not only a changed tag: a death cuts the room, and the next view brings it back.
  useEffect(() => ambience(place?.sound, weather, !!place?.exposed), [s.view]); // eslint-disable-line react-hooks/exhaustive-deps
  const reduced = useReducedMotion();
  useCues(s.view, s.catchingUp, turn, resumes, reduced, playTurn, s.died, s.deed);
}
