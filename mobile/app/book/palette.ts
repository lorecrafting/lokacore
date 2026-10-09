// The shown palette (tokens.ts `color`), provided once by the Book; every component reads it here.
import { createContext, useContext } from 'react';
import { color, type } from './tokens.ts';

export type Palette = typeof color.light;
export const PaletteContext = createContext<Palette>(color.light);
export const usePalette = () => useContext(PaletteContext);

export const prose = (c: Palette) => ({ ...type.body, color: c.fg });
export const note = (c: Palette) => ({ ...type.body, color: c.dim });
