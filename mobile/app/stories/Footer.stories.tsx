// Footer: the map joystick between two hairline rules (Footer's doc comment).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fireEvent, fn, waitFor } from 'storybook/test';
import { Footer } from '../book/Footer.tsx';

type Exit = Parameters<typeof Footer>[0]['exits'][number];
const open = (direction: string) => ({ direction, available: true }) as Exit;
const barred = (direction: string) =>
  ({ direction, available: false, reason: { code: 'exit_locked' } }) as Exit;
// A door shut across the way: closed (path ink) or locked (danger ink), owner 2026-10-23.
const shut = (direction: string, state: 'closed' | 'locked') =>
  ({
    direction,
    available: false,
    reason: { code: state === 'locked' ? 'exit_locked' : 'exit_closed' },
    door: { name: `${direction} door`, state, actions: [] },
  }) as unknown as Exit;

const meta = {
  title: 'Book/Footer',
  component: Footer,
  args: {
    keyboardEnabled: false,
    exits: [open('north'), open('east'), open('south'), open('west')],
    text: (key: string) => key,
    go: fn(),
    door: fn(() => false),
    refused: fn(),
    openMap: fn(),
    learned: { seen: () => true, see: fn() },
  },
} satisfies Meta<typeof Footer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {};

// Press and hold the map: it zooms to full size and a drag lights a path; nothing walks or opens
// until release.
export const Held: Story = {
  play: async ({ canvas, args }) => {
    const map = canvas.getByRole('button', { name: 'Map' });
    const drawing = map.firstElementChild as HTMLElement; // MapDrawing's scaled layer
    await expect(drawing.style.transform).not.toBe('scale(1)');
    // RN web's responder takes mouse events; user-event's pointer sequence never reached it.
    fireEvent.mouseDown(map, { button: 0, buttons: 1 });
    await waitFor(() => expect(drawing.style.transform).toBe('scale(1)'));
    // Drag up: north lights; its shown name leads the button's name (axe: label in name).
    fireEvent.mouseMove(map, { buttons: 1, clientY: -40 });
    await expect(await canvas.findByRole('button', { name: /^north, Map$/ })).toBeVisible();
    await expect(args.go).not.toHaveBeenCalled();
    await expect(args.openMap).not.toHaveBeenCalled();
  },
};

export const Tip: Story = { args: { learned: { seen: () => false, see: fn() } } };

export const BarredExit: Story = {
  args: { exits: [open('north'), open('south'), barred('west')] },
};

export const UpAndDown: Story = { args: { exits: [open('north'), open('up'), open('down')] } };

// A locked door west and a closed door east: the ticks tell them apart. Release toward the locked
// door with no key offered logs its one line; nothing walks.
export const DoorExits: Story = {
  args: { exits: [open('north'), shut('east', 'closed'), shut('west', 'locked')] },
  play: async ({ canvas, args }) => {
    const map = canvas.getByRole('button', { name: 'Map' });
    fireEvent.mouseDown(map, { button: 0, buttons: 1 });
    fireEvent.mouseMove(map, { buttons: 1, clientX: -40 });
    fireEvent.mouseUp(map, { clientX: -40 });
    await waitFor(() => expect(args.door).toHaveBeenCalledWith('west'));
    await expect(args.refused).toHaveBeenCalled();
    await expect(args.go).not.toHaveBeenCalled();
  },
};
