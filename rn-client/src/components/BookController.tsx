import React, { useEffect, useRef, useState, useCallback, useMemo, createContext, useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import { makeImageFromView, type SkImage } from '@shopify/react-native-skia';
import { useGameStore } from '../store/gameStore';
import { usePageSound } from '../hooks/usePageSound';
import { PageCurlAnimation } from './PageCurlAnimation';
import { NavigationContext } from './NavigationContext';
import { MOCK_ROOMS } from '../data/mockRooms';
import { RoomPage } from './pages/RoomPage';
import { DialoguePage } from './pages/DialoguePage';
import { EntityPage } from './pages/EntityPage';
import { MenuPage } from './pages/MenuPage';
import { ShopPage } from './pages/ShopPage';
import { ContainerPage } from './pages/ContainerPage';
import { BottomBar } from './bottombar/BottomBar';
import type { PageType, Direction } from '../types/game';

type AnimationState = 'IDLE' | 'CAPTURING' | 'ANIMATING';

const PAGE_ORDER: PageType[] = ['ROOM', 'ENTITY', 'DIALOGUE', 'SHOP', 'CONTAINER', 'MENU'];

// Context for preset preview — lets BottomBar trigger curl animations
interface PresetPreviewCtx {
  previewPreset: (presetKey: string) => void;
  currentPreset: string;
}
export const PresetPreviewContext = createContext<PresetPreviewCtx>({
  previewPreset: () => {},
  currentPreset: 'STANDARD_PAPER',
});
export const usePresetPreview = () => useContext(PresetPreviewContext);

export function BookController() {
  const currentPage = useGameStore((s) => s.currentPage);
  const room = useGameStore((s) => s.room);
  const setRoom = useGameStore((s) => s.setRoom);
  const addEvent = useGameStore((s) => s.addEvent);
  const { playFlip } = usePageSound();

  const [displayedPage, setDisplayedPage] = useState<PageType>(currentPage);
  const [animState, setAnimState] = useState<AnimationState>('IDLE');
  const [departingImage, setDepartingImage] = useState<SkImage | null>(null);
  const [curlPreset, setCurlPreset] = useState('STANDARD_PAPER');
  const [flipDirection, setFlipDirection] = useState<'forward' | 'reverse'>('forward');

  // Hidden surface used to pre-render the destination page for reverse transitions.
  // Rendered off-screen so we can capture it without touching the main view.
  const [hiddenCapturePage, setHiddenCapturePage] = useState<PageType | null>(null);
  const hiddenCaptureRef = useRef<View>(null);

  // For reverse transitions: the page switch is deferred until animation completion
  // so ENTITY stays as background (no ROOM content to accidentally ghost-tap during
  // the animation). Called before clearing the overlay so the correct page is
  // always in place when the animation disappears.
  const pendingCompletionRef = useRef<(() => void) | null>(null);

  const pageRef = useRef<View>(null);
  const prevCurrentPageRef = useRef(currentPage);
  const transitioningRef = useRef(false);

  const startTransition = useCallback(
    async (action: () => void, preset?: string) => {
      if (transitioningRef.current) {
        action();
        return;
      }

      transitioningRef.current = true;
      setAnimState('CAPTURING');
      if (preset) setCurlPreset(preset);

      let image: SkImage | null = null;
      if (pageRef.current) {
        try {
          image = await makeImageFromView(pageRef);
        } catch (e) {
          console.warn('[BookController] Failed to capture page:', e);
        }
      }

      action();

      if (image) {
        setDepartingImage(image);
        playFlip();
        setAnimState('ANIMATING');
      } else {
        transitioningRef.current = false;
        setAnimState('IDLE');
      }
    },
    [playFlip],
  );

  // Preview a preset — triggers a page turn without changing any state
  const previewPreset = useCallback(
    (presetKey: string) => {
      if (transitioningRef.current) return;
      setCurlPreset(presetKey);

      // Dummy transition — action is a no-op, just plays the curl animation
      startTransition(() => {}, presetKey);
    },
    [startTransition],
  );

  const navigate = useCallback(
    (direction: Direction) => {
      if (!room || transitioningRef.current) return;

      const exit = room.exits.find((e) => e.direction === direction);
      if (!exit?.destination_key) return;

      const nextRoom = MOCK_ROOMS[exit.destination_key];
      if (!nextRoom) return;

      startTransition(() => {
        addEvent(`You go ${direction}.`);
        setRoom(nextRoom);
      });
    },
    [room, startTransition, addEvent, setRoom],
  );

  useEffect(() => {
    if (currentPage === prevCurrentPageRef.current) return;

    const prev = prevCurrentPageRef.current;
    prevCurrentPageRef.current = currentPage;

    if (transitioningRef.current) return;

    const prevIdx = PAGE_ORDER.indexOf(prev);
    const nextIdx = PAGE_ORDER.indexOf(currentPage);
    const isReverse = nextIdx < prevIdx;

    setFlipDirection(isReverse ? 'reverse' : 'forward');

    if (!isReverse) {
      // Forward: capture current page, switch to destination, animate current away.
      startTransition(() => {
        setDisplayedPage(currentPage);
      });
      return;
    }

    // Reverse: the destination page (e.g. ROOM) should be the page that animates IN,
    // while the source page (e.g. ENTITY) stays visible as the background.
    //
    // We render the destination in a hidden off-screen surface, capture it, then
    // play the reverse animation with that image as the "arriving" page. The
    // displayedPage only switches to the destination once the animation completes.
    const dest = currentPage;

    transitioningRef.current = true;
    setAnimState('CAPTURING');
    setHiddenCapturePage(dest);

    (async () => {
      // Wait two frames so React has painted the hidden capture surface.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      let arrivalImage: SkImage | null = null;
      if (hiddenCaptureRef.current) {
        try {
          arrivalImage = await makeImageFromView(hiddenCaptureRef);
        } catch (e) {
          console.warn('[BookController] Failed to capture arrival page:', e);
        }
      }

      setHiddenCapturePage(null);

      if (arrivalImage) {
        // Keep displayedPage = ENTITY during the animation so there is no
        // live ROOM content underneath that a ghost tap could trigger. The
        // page switch is deferred to handleAnimationComplete via pendingCompletionRef.
        pendingCompletionRef.current = () => setDisplayedPage(dest);
        setDepartingImage(arrivalImage);
        playFlip();
        setAnimState('ANIMATING');
      } else {
        // Fallback: switch immediately with no animation.
        setDisplayedPage(dest);
        transitioningRef.current = false;
        setAnimState('IDLE');
      }
    })();
  }, [currentPage, startTransition, playFlip]);

  const handleAnimationComplete = useCallback(() => {
    // Switch to the destination page BEFORE clearing the overlay. runOnJS runs
    // outside React's batching context, so these may be separate renders. By
    // switching pages first, displayedPage is correct when the overlay disappears —
    // no entity flash even if the renders aren't batched.
    const pending = pendingCompletionRef.current;
    pendingCompletionRef.current = null;
    if (pending) {
      pending();
    } else {
      setDisplayedPage(currentPage);
    }
    setDepartingImage(null);
    transitioningRef.current = false;
    setAnimState('IDLE');
  }, [currentPage]);

  const navigationValue = useMemo(() => ({ navigate }), [navigate]);
  const presetValue = useMemo(
    () => ({ previewPreset, currentPreset: curlPreset }),
    [previewPreset, curlPreset],
  );
  const showBottomBar = displayedPage === 'ROOM';

  return (
    <NavigationContext.Provider value={navigationValue}>
      <PresetPreviewContext.Provider value={presetValue}>
        <View style={styles.container}>
          {/* Main page — what the user sees */}
          <View
            ref={pageRef}
            style={styles.page}
            collapsable={false}
            pointerEvents={animState === 'ANIMATING' ? 'none' : 'auto'}
          >
            <PageContent page={displayedPage} />
          </View>

          {showBottomBar && (
            <View style={styles.bottomBar}>
              <BottomBar />
            </View>
          )}

          {/* Hidden capture surface — renders destination page for reverse transitions */}
          {hiddenCapturePage !== null && (
            <View
              ref={hiddenCaptureRef}
              style={styles.hiddenCapture}
              collapsable={false}
              pointerEvents="none"
            >
              <PageContent page={hiddenCapturePage} />
            </View>
          )}

          <PageCurlAnimation
            animating={animState === 'ANIMATING'}
            departingImage={departingImage}
            onComplete={handleAnimationComplete}
            preset={curlPreset}
            direction={flipDirection}
          />
        </View>
      </PresetPreviewContext.Provider>
    </NavigationContext.Provider>
  );
}

interface PageContentProps {
  page: PageType;
}

function PageContent({ page }: PageContentProps) {
  switch (page) {
    case 'ROOM':
      return <RoomPage />;
    case 'DIALOGUE':
      return <DialoguePage />;
    case 'ENTITY':
      return <EntityPage />;
    case 'MENU':
      return <MenuPage />;
    case 'SHOP':
      return <ShopPage />;
    case 'CONTAINER':
      return <ContainerPage />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  // Capture surface for reverse transitions: rendered behind the main page at full
  // opacity so makeImageFromView gets accurate pixel content. zIndex: -1 ensures
  // it stays invisible to the user (the main page sits on top).
  hiddenCapture: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
});
