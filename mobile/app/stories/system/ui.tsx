// Shared bits of the System pages: plain DOM in the Book's palette and fonts.
import type { CSSProperties, ReactNode } from 'react';
import { usePalette } from '../../book/palette.ts';
import { space, type } from '../../book/tokens.ts';

// Text with `code` spans, as the schemas and save.md write them.
export const Prose = ({ text }: { text: string }) => (
  <>{text.split('`').map((s, i) => (i % 2 ? <code key={i}>{s}</code> : s))}</>
);

// A page: body font and ink on the paper; wide tables scroll inside it, on the paper too.
export function Sheet({ children }: { children: ReactNode }) {
  const c = usePalette();
  return (
    <div style={{ ...small, color: c.fg, background: c.bg, overflowX: 'auto', padding: space.xl }}>
      {children}
    </div>
  );
}

// tokens.ts text styles for the DOM: React leaves a numeric lineHeight unitless (a multiple).
type Text = { fontFamily: string; fontSize: number; lineHeight: number };
const px = ({ fontFamily, fontSize, lineHeight }: Text) => ({
  fontFamily,
  fontSize,
  lineHeight: `${lineHeight}px`,
});
export const small = px(type.small);
export const heading = px(type.log);

export const cell: CSSProperties = {
  textAlign: 'left',
  verticalAlign: 'top',
  paddingBlock: space.xs,
  paddingInline: space.md,
};

// A link in the action colour (the browser's blue fails contrast on the dark page).
export function Link({
  href,
  children,
  top,
}: {
  href: string;
  children: ReactNode;
  top?: boolean;
}) {
  const c = usePalette();
  return (
    <a href={href} target={top ? '_top' : '_blank'} rel="noreferrer" style={{ color: c.action }}>
      {children}
    </a>
  );
}
