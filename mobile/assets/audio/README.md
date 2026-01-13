# Audio Assets for Loka

This directory contains ambient, weather, UI, and event sounds for the game.

## Directory Structure

```
audio/
├── ambient/     # Biome/phase-based background loops
├── weather/     # Weather overlay sounds (rain, wind)
├── light/       # Light source sounds (torch crackling)
├── ui/          # UI interaction sounds
└── events/      # Game event sounds (combat, quests)
```

## Recommended Free Sound Sources (CC0 Licensed)

All sounds below are CC0 (public domain) - no attribution required.

### Ambient Sounds

| Sound Key | Freesound Link | Notes |
|-----------|----------------|-------|
| `temple_bells` | [temple bells.wav by Paresh](https://freesound.org/people/Paresh/sounds/423401/) | Meditation bells, 1:22, CC0 |
| `forest_birds_dawn` | [Forest birds - ambient seamless loop by Magnesus](https://freesound.org/people/Magnesus/sounds/723913/) | Perfect loop, CC0 |
| `forest_ambient` | [Forest Ambient LOOP by Imjeax](https://freesound.org/people/Imjeax/sounds/427400/) | Video game forest loop |
| `cave_drips` | [Cave Drips by everythingsounds](https://freesound.org/people/everythingsounds/sounds/199515/) | Water drips foley |
| `cave_echo` | [Cave Ambience Loop by hushless](https://freesound.org/people/hushless/sounds/770379/) | Dark cave atmosphere |
| `crickets` | [AMBIENCE NIGHT FIELD CRICKET by sengjinn](https://freesound.org/people/sengjinn/sounds/175020/) | Midnight crickets, CC0 |
| `crickets_clean` | [Crickets At Night by Defelozedd94](https://freesound.org/people/Defelozedd94/sounds/522298/) | Clean recording, CC0 |

### Additional Sound Packs

- [Japanese temple bells by MShades](https://freesound.org/people/MShades/packs/1695/) - Multiple temple bell sounds
- [Ambient Nature Soundscapes by Luftrum](https://freesound.org/people/Luftrum/packs/3069/) - Nature ambiences
- [Ambients of the Nature by unfa](https://freesound.org/people/unfa/packs/9696/) - Forest recordings
- [OpenGameArt - Crickets loopable](https://opengameart.org/content/crickets-ambient-noise-loopable) - 11s loop

## How to Add Sounds

1. Download sounds from Freesound.org (requires free account)
2. Convert to MP3 format if needed (128kbps is sufficient)
3. For loops, ensure seamless looping (use Audacity to trim/crossfade)
4. Place in appropriate subdirectory
5. Update `src/audio/soundAssets.ts` to uncomment the require() line

## File Naming Convention

Use the key names from `soundAssets.ts`:
- `temple_bells.mp3`
- `forest_birds_dawn.mp3`
- `cave_drips.mp3`
- etc.

## Recommended File Specs

| Type | Duration | Format | Bitrate |
|------|----------|--------|---------|
| Ambient loops | 60-120s | MP3 | 128kbps |
| Weather loops | 30-60s | MP3 | 128kbps |
| UI sounds | 0.2-0.5s | MP3 | 128kbps |
| Event sounds | 0.5-2s | MP3 | 128kbps |

**Target total size**: < 5MB for all sounds combined
