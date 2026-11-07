// The panel's dev-only forms (docs/system/cartridge.md#author-preview).
import { useState } from 'react';
import type { State } from './book.ts';
import { Button } from './components/ui/button.tsx';
import { Input } from './components/ui/input.tsx';
import type { Send } from './sections.tsx';

export function GoToRoom({ state, send }: { state?: State; send: Send }) {
  const [room, setRoom] = useState('');
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send({ op: 'go_to_room', room });
      }}
    >
      <Input
        aria-label="Room key"
        placeholder="room key"
        value={room}
        onChange={(e) => setRoom(e.target.value)}
      />
      <Button type="submit" variant="secondary" disabled={!state || !room}>
        Go to room
      </Button>
    </form>
  );
}

export function SetFact({ state, send }: { state?: State; send: Send }) {
  const [fact, setFact] = useState('');
  const [value, setValue] = useState('');
  const typedValue = () => {
    try {
      const parsed: unknown = JSON.parse(value); // true, false, a number or a "quoted" string
      const plain = typeof parsed === 'boolean' || typeof parsed === 'string' || Number.isFinite(parsed);
      return plain ? (parsed as boolean | number | string) : value; // 1e999 is no number the game can hold
    } catch {
      return value; // a bare word is an enum's or a string's
    }
  };
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send({ op: 'set_fact', fact, value: typedValue() });
      }}
    >
      <Input
        aria-label="Fact key"
        placeholder="fact key"
        value={fact}
        onChange={(e) => setFact(e.target.value)}
      />
      <Input
        aria-label="Fact value"
        placeholder="value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button type="submit" variant="secondary" disabled={!state || !fact || !value}>
        Set fact
      </Button>
    </form>
  );
}

export function SetLevel({ state, send }: { state?: State; send: Send }) {
  const [level, setLevel] = useState('');
  const [attribute, setAttribute] = useState('');
  const [points, setPoints] = useState('');
  const sent = () => send({ op: 'set_level', level: Number(level), points: attribute ? { [attribute]: Number(points) } : {} });
  return (
    <form className="mt-2 flex gap-2" onSubmit={(e) => (e.preventDefault(), sent())}>
      <Input aria-label="Level" placeholder="level" inputMode="numeric" value={level} onChange={(e) => setLevel(e.target.value)} />
      <Input aria-label="Attribute key" placeholder="attribute key" value={attribute} onChange={(e) => setAttribute(e.target.value)} />
      <Input aria-label="Attribute points" placeholder="points" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} />
      <Button type="submit" variant="secondary" disabled={!state || !level || (!!attribute && !points)}>
        Set level
      </Button>
    </form>
  );
}
