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

  const pageRef = useRef<View>(null);
  const prevCurrentPageRef = useRef(currentPage);
  const transitioningRef = useRef(false);
  // Destination page for the current reverse transition. Set before animation starts
  // and read by onNearComplete (fired mid-animation) to switch displayedPage while
  // the overlay is still fully opaque — so ROOM, not ENTITY, shows through the fade.
  const nearCompleteDestRef = useRef<PageType | null>(null);

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

    // Reverse: render the destination (e.g. ROOM) in a hidden off-screen surface,
    // capture it as the "arriving" page image, then play the reverse animation.
    // displayedPage switches to the destination before the animation starts so that
    // ROOM is already the static background when the overlay fades out at landing.
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
        // Keep displayedPage = ENTITY so the page doesn't change before the flip
        // covers it. nearCompleteDestRef stores the destination; onNearComplete
        // (fired by PageCurlAnimation at progress ≈ 0.05, before the landing fade
        // begins at 0.02) switches displayedPage while the overlay is still opaque.
        nearCompleteDestRef.current = dest;
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

  // Fired mid-animation (progress ≈ 0.05) while overlay is still fully opaque.
  // Switches displayedPage so ROOM is the static background before the landing
  // fade (progress 0.02→0) begins — no ENTITY shows through as overlay fades.
  const handleNearComplete = useCallback(() => {
    if (nearCompleteDestRef.current) {
      setDisplayedPage(nearCompleteDestRef.current);
      nearCompleteDestRef.current = null;
    }
  }, []);

  const handleAnimationComplete = useCallback(() => {
    // displayedPage was already switched in handleNearComplete. landingFadeOpacity
    // in PageCurlAnimation faded the canvas to 0 before this fires, so removing
    // departingImage here causes no flash.
    nearCompleteDestRef.current = null; // safety clear
    setDepartingImage(null);
    transitioningRef.current = false;
    setAnimState('IDLE');
  }, []);

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
            onNearComplete={handleNearComplete}
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
