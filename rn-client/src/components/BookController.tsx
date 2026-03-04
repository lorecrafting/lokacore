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

    startTransition(() => {
      setDisplayedPage(currentPage);
    });
  }, [currentPage, startTransition]);

  const handleAnimationComplete = useCallback(() => {
    setDepartingImage(null);
    setDisplayedPage(currentPage);
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
          <View ref={pageRef} style={styles.page} collapsable={false}>
            <PageContent page={displayedPage} />
          </View>

          {showBottomBar && (
            <View style={styles.bottomBar}>
              <BottomBar />
            </View>
          )}

          <PageCurlAnimation
            animating={animState === 'ANIMATING'}
            departingImage={departingImage}
            onComplete={handleAnimationComplete}
            preset={curlPreset}
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
});
