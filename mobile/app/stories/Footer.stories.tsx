// Footer: the map joystick between two hairline rules (BOOK-UI-COMPONENTS.md, Footer).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fireEvent, fn, waitFor } from 'storybook/test';
import { Footer } from '../book/Footer.tsx';

type Exit = Parameters<typeof Footer>[0]['exits'][number];
const open = (direction: string) => ({ direction, available: true }) as Exit;
const barred = (direction: string) =>
  ({ direction, available: false, reason: { code: 'exit_locked' } }) as Exit;

const meta = {
  title: 'Book/Footer',
  component: Footer,
  args: {
    keyboardEnabled: false,
    exits: [open('north'), open('east'), open('south'), open('west')],
    text: (key: string) => key,
    go: fn(),
    refused: fn(),
    openMap: fn(),
    learned: { seen: () => true, see: fn() },
  },
} satisfies Meta<typeof Footer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {};

// Press and hold the map: it zooms to full size; nothing walks or opens until release.
export const Held: Story = {
  play: async ({ canvas, args }) => {
    const map = canvas.getByRole('button', { name: 'Map' });
    const drawing = map.firstElementChild as HTMLElement; // MapDrawing's scaled layer
    await expect(drawing.style.transform).not.toBe('scale(1)');
    // RN web's responder takes mouse events; user-event's pointer sequence never reached it.
    fireEvent.mouseDown(map, { button: 0, buttons: 1 });
    await waitFor(() => expect(drawing.style.transform).toBe('scale(1)'));
    await expect(args.go).not.toHaveBeenCalled();
    await expect(args.openMap).not.toHaveBeenCalled();
  },
};

export const Tip: Story = { args: { learned: { seen: () => false, see: fn() } } };

export const BarredExit: Story = {
  args: { exits: [open('north'), open('south'), barred('west')] },
};

export const UpAndDown: Story = { args: { exits: [open('north'), open('up'), open('down')] } };

export const Night: Story = { globals: { palette: 'dark' } };
