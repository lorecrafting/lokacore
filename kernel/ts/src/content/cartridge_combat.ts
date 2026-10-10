// Attack profiles and finite authored death credit; twin of Loka.Content.Combat.
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';
import { same } from '../foundation/compose.ts';
import { apiCmp } from './cartridge_installed.ts';
import type { Diagnostic } from '../contracts.gen.ts';

export function combat(c: Obj, named: Checks['named']): Diagnostic[] {
  const out: Diagnostic[] = [];
  const settings = c.world?.combat;
  const bad = (at: string) => out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
  const profile = (p: Obj, at: string) => {
    if (p.damage_min > p.damage_max) bad(`${at}.damage_max`);
  };
  if (settings) {
    if (!c.world.death) bad('.cartridge.world.death');
    out.push(...requirements(c));
    profile(settings.player_attack, '.cartridge.world.combat.player_attack');
    for (const [field, key] of Object.entries(settings.narration) as [string, string][])
      if (!Object.hasOwn(c.text, key))
        out.push(
          diag('UNRESOLVED_REFERENCE', `.cartridge.world.combat.narration.${field}`, {
            target: key,
          }),
        );
  }
  for (const [ref, npc] of Object.entries((c.npcs ?? {}) as Obj)) {
    if (!npc.attack) continue;
    const at = `.cartridge.npcs${step(ref)}`;
    profile(npc.attack, `${at}.attack`);
    if (!settings) bad(`${at}.attack`);
    if (!npc.hp) bad(`${at}.hp`);
  }
  return [...out, ...damageApi(c), ...deathCredit(c, named)];
}

// Toolbox row G2: damage kinds, crits and resistances need kernel_api 1.44.
function damageApi(c: Obj): Diagnostic[] {
  const npcs = Object.values((c.npcs ?? {}) as Obj);
  const items = Object.values((c.items ?? {}) as Obj).map((i) => i.weapon?.attack);
  const profiles = [c.world?.combat?.player_attack, ...npcs.map((n) => n.attack), ...items];
  const used = profiles.some((p) => p?.kind || p?.crit) || npcs.some((n) => n.resistances);
  return used && apiCmp(c.manifest.requires.kernel_api.at_least, '1.44') < 0
    ? [diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least')]
    : [];
}

function deathCredit(c: Obj, named: Checks['named']): Diagnostic[] {
  const out: Diagnostic[] = [];
  const bad = (at: string) => out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
  const credits = c.world?.death_credit;
  if (credits && !c.world?.combat) bad('.cartridge.world.death_credit');
  const counts = { npc: new Map<string, number>(), fact: new Map<string, number>() };
  for (const credit of credits ?? [])
    for (const field of ['npc', 'fact'] as const) {
      const ref = refString(credit[field]);
      counts[field].set(ref, (counts[field].get(ref) ?? 0) + 1);
    }
  for (const [i, credit] of (credits ?? []).entries()) {
    const at = `.cartridge.world.death_credit[${i}]`;
    for (const field of ['npc', 'room', 'fact']) named(credit[field], field, `${at}.${field}`);
    for (const field of ['npc', 'fact'] as const) {
      const ref = refString(credit[field]);
      if (counts[field].get(ref)! > 1) bad(`${at}.${field}`);
    }
    const npc = c.npcs?.[refString(credit.npc)];
    if (npc) {
      if (!npc.attack) bad(`${at}.npc`);
      if (c.rooms[refString(credit.room)] && !same(npc.room, credit.room)) bad(`${at}.room`);
    }
    const fact = c.facts[refString(credit.fact)];
    if (
      fact &&
      (!same(fact.scopes, ['player']) ||
        fact.value_type.type !== 'bool' ||
        fact.value_type.default !== false)
    )
      bad(`${at}.fact`);
  }
  return out;
}

function requirements(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
  if (major < 1 || (major === 1 && minor < 6))
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  for (const capability of ['combat', 'schedule', 'death'])
    if (c.lock.capabilities[capability] !== 1)
      out.push(
        diag('UNDECLARED_CAPABILITY', '.cartridge.world.combat', { capability }, [
          `${capability}@1`,
        ]),
      );
  return out;
}
