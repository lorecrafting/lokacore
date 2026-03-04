import { createContext, useContext } from 'react';
import type { Direction } from '../types/game';

interface NavigationContextType {
  navigate: (direction: Direction) => void;
}

export const NavigationContext = createContext<NavigationContextType>({
  navigate: () => {},
});

export function useNavigation() {
  return useContext(NavigationContext);
}
