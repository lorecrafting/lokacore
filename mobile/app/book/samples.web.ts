// The recorded samples, on the web only: Metro and Vite both give each file's URL. Rows, licences and
// credits: sounds/manifest.json (bin/check_sounds.py). Which file each name plays: audio-listening-list.md.
import { sources } from './sound';
import fightIn from './sounds/mus-fight-stinger-01.m4a';
import fightLoop from './sounds/mus-fight-loop-01.m4a';
import fightWon from './sounds/mus-fight-won-01.m4a';
import impact1 from './sounds/sfx-impact-01.m4a';
import impact2 from './sounds/sfx-impact-02.m4a';
import impact3 from './sounds/sfx-impact-03.m4a';
import chapter from './sounds/mus-theme-chapter-01.m4a';
import coin from './sounds/sfx-coin-clink-01.m4a';
import noteHigh from './sounds/sfx-harp-note-high-01.m4a';
import noteLow from './sounds/sfx-harp-note-low-01.m4a';
import toneHigh from './sounds/sfx-harp-tone-high-01.m4a';
import toneLow from './sounds/sfx-harp-tone-low-01.m4a';
import close from './sounds/sfx-paper-close-01.m4a';
import thud from './sounds/sfx-paper-thud-01.m4a';
import flick from './sounds/ui-paper-flick-01.m4a';
import tick from './sounds/ui-paper-tick-01.m4a';
import turn1 from './sounds/ui-paper-turn-01.m4a';
import turn2 from './sounds/ui-paper-turn-02.m4a';
import turn3 from './sounds/ui-paper-turn-03.m4a';
import bedWild from './sounds/amb-wild-01.m4a';
import pieceWild from './sounds/mus-explore-wild-01.m4a';
import bedShore from './sounds/amb-shore-01.m4a';
import pieceShore from './sounds/mus-explore-shore-01.m4a';
import bedMill from './sounds/amb-mill-01.m4a';
import pieceMill from './sounds/mus-explore-mill-01.m4a';
import bedVillage from './sounds/amb-village-01.m4a';
import pieceVillage from './sounds/mus-explore-village-01.m4a';
import bedCave from './sounds/amb-cave-01.m4a';
import pieceCave from './sounds/mus-explore-cave-01.m4a';
import bedCrypt from './sounds/amb-crypt-01.m4a';
import pieceCrypt from './sounds/mus-explore-crypt-01.m4a';
import bedVault from './sounds/amb-vault-01.m4a';
import pieceVault from './sounds/mus-explore-vault-01.m4a';
import bedForge from './sounds/amb-forge-01.m4a';
import pieceForge from './sounds/mus-explore-forge-01.m4a';
import bedInn from './sounds/amb-inn-01.m4a';
import pieceInn from './sounds/mus-explore-inn-01.m4a';
import bedChurch from './sounds/amb-church-01.m4a';
import pieceChurch from './sounds/mus-explore-church-01.m4a';
import rain from './sounds/amb-rain-01.m4a';
import latch from './sounds/sfx-latch-01.m4a';
import lever from './sounds/sfx-lever-01.m4a';
import miss from './sounds/sfx-miss-01.m4a';
import thunder1 from './sounds/sfx-thunder-01.m4a';
import thunder2 from './sounds/sfx-thunder-02.m4a';
import thunder3 from './sounds/sfx-thunder-03.m4a';

sources(
  {
    pageTurn: [turn1, turn2, turn3],
    pickup: [flick],
    tick: [tick],
    coin: [coin],
    blow: [thud],
    level: [noteHigh],
    skillNew: [noteLow],
    questDone: [noteLow],
    questFailed: [close],
    skillUp: [toneHigh],
    questGained: [toneLow],
    chapter: [chapter],
    fightIn: [fightIn],
    fightLoop: [fightLoop],
    fightWon: [fightWon],
    impact: [impact1, impact2, impact3],
    miss: [miss],
    lever: [lever],
    latch: [latch],
    thunder: [thunder1, thunder2, thunder3],
    weather: [rain],
  },
  {
    beds: {
      wild: bedWild,
      shore: bedShore,
      mill: bedMill,
      village: bedVillage,
      cave: bedCave,
      crypt: bedCrypt,
      vault: bedVault,
      forge: bedForge,
      inn: bedInn,
      church: bedChurch,
    },
    pieces: {
      wild: pieceWild,
      shore: pieceShore,
      mill: pieceMill,
      village: pieceVillage,
      cave: pieceCave,
      crypt: pieceCrypt,
      vault: pieceVault,
      forge: pieceForge,
      inn: pieceInn,
      church: pieceChurch,
    },
  },
);
