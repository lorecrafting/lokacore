// What the Book plays: the cues of each view, and the sound of the room it is in.
import { useEffect } from 'react';
import { onCue, useCues } from './cues.ts';
import { playCue, playTurn } from './cueSounds.ts';
import { useReducedMotion } from './fade.ts';
import type { presenter } from './presenter.ts';
import { ambience } from './sound';

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;

export function useCueSounds(s: Screen, turn: number, resumes?: number) {
  useEffect(() => onCue(playCue), []); // before useCues: heard from its first cue
  const place = s.view.place;
  const weather = s.view.calendar_status?.weather;
  useEffect(
    () => ambience(place?.sound, weather, !!place?.exposed),
    [place?.sound, weather, place?.exposed],
  );
  const reduced = useReducedMotion();
  useCues(s.view, s.catchingUp, turn, resumes, reduced, playTurn, s.died, s.deed);
}
