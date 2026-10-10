import { cap, plain } from './model.ts';
import { Text } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import type { Thing } from './model.ts';
import { note, prose, usePalette } from './palette.ts';

export function SkillDetails(p: { view?: GameView; text: (key: string) => string }) {
  const c = usePalette();
  return (
    <>
      {p.view?.topics?.map((t) => (
        <Text key={t.topic.key} style={prose(c)}>
          {p.text(t.label)}
        </Text>
      ))}
      {p.view?.attributes?.map((a) => (
        <Text key={a.attribute.key} style={prose(c)}>
          {a.attribute.key.toUpperCase()} {a.value}
          {a.worn ? ` (${a.worn > 0 ? '+' : ''}${a.worn} worn)` : ''}
        </Text>
      ))}
      {p.view?.skills
        ?.filter((s) => s.acquired)
        .map((s) => (
          <Text key={s.skill.key} style={prose(c)}>
            {p.text(s.label)} — {s.qualified ? 'qualified' : 'unqualified'}; {p.text(s.requirement)}
          </Text>
        ))}
    </>
  );
}

export function ItemDetails(p: { thing?: Thing; text: (key: string) => string }) {
  const c = usePalette();
  const item = p.thing;
  return (
    <>
      {item?.description && <Text style={prose(c)}>{plain(p.text(item.description))}</Text>}
      {item?.liquid && (
        <Text style={note(c)}>
          {p.text(item.liquid.label)}: {item.liquid.quantity}/{item.liquid.capacity}{' '}
          {p.text(item.liquid.unit_label)}
        </Text>
      )}
      {item?.fuel && (
        <Text style={note(c)}>
          Fuel {item.fuel.remaining} of {item.fuel.capacity}
          {item.fuel.lit ? ', lit' : ', unlit'}
        </Text>
      )}
      {item?.state && <Text style={note(c)}>{cap(item.state)}</Text>}
      {item?.slot && (item.weapon || item.block_chance !== undefined) && (
        <Text style={note(c)}>Slot: {item.slot}</Text>
      )}
      {item?.weapon && (
        <Text style={note(c)}>
          Attack: {item.weapon.attack.chance}% chance, {item.weapon.attack.damage_min}–
          {item.weapon.attack.damage_max} damage; requires{' '}
          {item.skill_label ? p.text(item.skill_label) : item.weapon.skill.key}
          {item.skill_requirement ? ` (${p.text(item.skill_requirement)})` : ''}.
        </Text>
      )}
      {item?.block_chance !== undefined && (
        <Text style={note(c)}>Block: {item.block_chance}% chance.</Text>
      )}
    </>
  );
}
