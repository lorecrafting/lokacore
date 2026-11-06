// The NPC card's Schedule block (docs/rnd/gui-editor-design-2026-11-04.md §4.3): the day's hours
// down, each hour's room (or its cases, each with its `when`) across; the logic is
// kernel/ts/play/blocks.ts.
import { useState } from 'react';
import { toFieldPathId, type FieldProps } from '@rjsf/utils';
import { addHour, hours, rehour, roomPicks } from '../../../../../kernel/ts/play/blocks.ts';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import type { Context } from '../fields.tsx';
import { Refusal } from '../templates.tsx';

type Schedule = Record<string, unknown>;

/** The hour's number, moved on leaving the field; a refused hour is shown, never written. */
function Hour({ hour, move }: { hour: string; move: (to: string) => string | undefined }) {
  const [text, setText] = useState(hour);
  const [refused, refuse] = useState<string>();
  return (
    <label className="grid gap-1">
      <Input
        aria-label={`hour ${hour}`}
        aria-invalid={!!refused}
        inputMode="numeric"
        className="h-7 w-14 text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => refuse(move(text))}
      />
      {refused ? <Refusal>{refused}</Refusal> : null}
    </label>
  );
}

type RowProps = FieldProps & { hour: string; schedule: Schedule; write: (next: Schedule) => void };

/** One hour: its number, its room or cases (room keys by the room picker), and its removal. */
function Row({ hour: h, schedule, write, ...p }: RowProps) {
  const { registry, schema, uiSchema: ui, fieldPathId } = p;
  const perDay = (registry.formContext as Context).hours;
  return (
    <div className="flex items-start gap-2">
      <Hour
        hour={h}
        move={(to) => {
          const moved = rehour(schedule, h, to, perDay);
          if (typeof moved === 'string') return moved;
          if (to !== h) write(moved);
        }}
      />
      <div className="min-w-0 flex-1">
        <registry.fields.SchemaField
          {...p}
          name={h}
          schema={schema.additionalProperties as never}
          uiSchema={{ ...roomPicks(ui?.additionalProperties ?? {}), 'ui:label': false }}
          formData={schedule[h]}
          fieldPathId={toFieldPathId(h, registry.globalFormOptions, fieldPathId)}
          required
        />
      </div>
      <Button
        type="button"
        size="xs"
        variant="outline"
        aria-label={`remove hour ${h}`}
        onClick={() => write(Object.fromEntries(hours(schedule).filter(([k]) => k !== h)))}
      >
        Remove
      </Button>
    </div>
  );
}

/** Writes go straight to the card (as Placement does): an rjsf change made on a blur or a click
 * reaches the draft after the card's commit on that blur. */
export function Schedule(p: FieldProps) {
  const { hours: perDay, room, put } = p.registry.formContext as Context;
  const schedule = (p.formData ?? {}) as Schedule;
  const write = (next: Schedule) => put?.('daily_schedule', next);
  const next = addHour(schedule, room, perDay);
  return (
    <fieldset aria-label="Schedule" className="grid gap-2 text-xs">
      <legend className="font-medium">Schedule</legend>
      {hours(schedule).map(([h]) => (
        <Row key={h} {...p} hour={h} schedule={schedule} write={write} />
      ))}
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="justify-self-start"
        disabled={!next}
        title={next ? undefined : 'place the NPC in a room first, or the day is full'}
        onClick={() => next && write(next)}
      >
        Add hour
      </Button>
    </fieldset>
  );
}
