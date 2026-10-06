import { cap, plain } from './model.ts';
import { Text } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import type { Thing } from './model.ts';
import { prose, note } from './paper.ts';

export function SkillDetails(p: { view?: GameView; text: (key: string) => string }) {
  return (
    <>
      {p.view?.topics?.map((t) => (
        <Text key={t.topic.key} style={prose}>
          {p.text(t.label)}
        </Text>
      ))}
      {p.view?.attributes?.map((a) => (
        <Text key={a.attribute.key} style={prose}>
          {a.attribute.key.toUpperCase()} {a.value}
        </Text>
      ))}
      {p.view?.skills
        ?.filter((s) => s.acquired)
        .map((s) => (
          <Text key={s.skill.key} style={prose}>
            {p.text(s.label)} — {s.qualified ? 'qualified' : 'unqualified'}; {p.text(s.requirement)}
          </Text>
        ))}
    </>
  );
}

export function ItemDetails(p: { thing?: Thing; text: (key: string) => string }) {
  const item = p.thing;
  return (
    <>
      {item?.description && <Text style={prose}>{plain(p.text(item.description))}</Text>}
      {item?.fuel && (
        <Text style={note}>
          Fuel {item.fuel.remaining} of {item.fuel.capacity}
          {item.fuel.lit ? ', lit' : ', unlit'}
        </Text>
      )}
      {item?.state && <Text style={note}>{cap(item.state)}</Text>}
      {item?.slot && (item.weapon || item.block_chance !== undefined) && (
        <Text style={note}>Slot: {item.slot}</Text>
      )}
      {item?.weapon && (
        <Text style={note}>
          Attack: {item.weapon.attack.chance}% chance, {item.weapon.attack.damage_min}–
          {item.weapon.attack.damage_max} damage; requires{' '}
          {item.skill_label ? p.text(item.skill_label) : item.weapon.skill.key}
          {item.skill_requirement ? ` (${p.text(item.skill_requirement)})` : ''}.
        </Text>
      )}
      {item?.block_chance !== undefined && (
        <Text style={note}>Block: {item.block_chance}% chance.</Text>
      )}
    </>
  );
}
