// The add menu's gates: which fields a card offers, as the compiler accepts them (split from card.ts).
import REGISTRY from '../../../protocol/capability_registry.json' with { type: 'json' };

type Obj = Record<string, unknown>;

// Each field's owning capabilities, as UNDECLARED_CAPABILITY checks them (content/); a field it omits needs none.
const VARIANT = 'description_variant';
const OWNERS: Record<string, string> = {
  'npcs.ask': 'speech topic',
  'npcs.attack': 'combat', // world.combat needs it (combat.ex requirements); NEEDS has the rest
  'npcs.cues': 'sense_cue',
  'npcs.daily_schedule': 'schedule',
  'npcs.description_variants': VARIANT,
  'npcs.name_variants': VARIANT,
  'npcs.shop': 'commerce',
  'items.affects': 'attribute', // derived.ex owner/2
  'items.bandage': 'bleed combat skill food', // bleed.ex gate/1
  'items.cues': 'sense_cue',
  'items.description_variants': VARIANT,
  // food.ex:43-46 valid?
  'items.edible': 'food resource containment',
  'items.fuel': 'light',
  'items.name_variants': VARIANT,
  'items.readable': 'readable', // resolve.ex:338-344 via entities.ex:54; capability_registry.json:463
  'items.room_line_variants': VARIANT,
  'items.slot': 'equipment',
  'items.tags': 'tag',
  'items.weapon': 'skill', // its skill is a skill definition (skills.ex weapon)
  'rooms.cues': 'sense_cue',
  // resolve.ex:391-394 via room_parts.ex:83 (darkness, capability_registry.json:428)
  'rooms.dark': 'light',
  'rooms.dark_description': 'light',
  'rooms.details': 'inspectable_detail',
  'rooms.site': 'construction',
  'rooms.tags': 'tag',
  'rooms.variants': VARIANT,
  'quests.expedition': 'expedition movement quest fact combat death population', // expedition.ex:29-32
  'quests.patrol': 'patrol movement quest dialogue fact death', // patrol.ex:31-33
  'dialogues.keyword': 'speech', // keywords.ex:15: speech@1 owns `spoken`
  // check_kinds.ex:26: check@1 owns check_passed
  'dialogues.choices.check': 'check',
  // escort.ex:10: escort@1 owns the escort definition
  'dialogues.choices.escort': 'escort',
  // dialogues.ex:383: containment@1 owns item_acquired
  'dialogues.choices.receive': 'containment',
  'actions.check': 'check', // its check_passed (scripted_actions.ex:125)
  'actions.tip': 'fact', // its fact_changed (action_tips.ex:40)
  'populations.trail': 'fact', // its fact_changed (trails.ex:139; capability_registry.json:143)
  'populations.hunts': 'fact',
  'actions.policy': 'policy', // its least `all` (resolve.ex:415)
  'reactions.when': 'policy',
  'barriers.opens_when': 'policy',
  'dialogues.policy': 'policy',
  'dialogues.choices.policy': 'policy', // a choice's policy is a root too (dialogue_links.ex:12; policies.ex:26)
  'populations.birth_when': 'policy',
  'populations.wander_when': 'policy',
  // emote@1 owns every room's, NPC's or item's ambient (emotes.ex:3-4, :25)
  'npcs.ambient': 'emote',
  'items.ambient': 'emote',
  'rooms.ambient': 'emote',
};

// Beyond capabilities: an NPC's attack needs world.combat and the NPC's hp (combat.ex npc_profiles).
const NEEDS: Record<string, (doc: Obj, world: Obj, hidden: string[]) => boolean> = {
  'npcs.attack': (doc, world) => doc.hp !== undefined && world.combat !== undefined,
  'npcs.daily_schedule': (doc) => doc.spawn_template !== true, // calendar.ex template_schedules
  'items.weapon': (doc) => doc.slot === 'wield' && doc.edible === undefined, // skills.ex weapon
  // affects need a slot (derived.ex:77); a bandage is no container, worn or eaten thing (bleed.ex:88-91)
  'items.affects': (doc) => doc.slot !== undefined,
  'items.bandage': (doc) =>
    doc.slot === undefined && doc.edible === undefined && doc.container !== true,
  'items.slot': (doc) => doc.bandage === undefined && doc.edible === undefined,
  // food.ex:43-46 valid?: nothing eaten is a container, worn, a weapon, a fuel or a vessel
  'items.edible': (doc) =>
    doc.bandage === undefined &&
    doc.container !== true &&
    !['capacity', 'slot', 'weapon', 'block_chance', 'fuel', 'vessel'].some((f) =>
      Object.hasOwn(doc, f),
    ),
  // derived.ex:64
  'items.equip': (doc) => doc.slot !== undefined,
  'items.container': (doc) => doc.bandage === undefined && doc.edible === undefined,
  ...Object.fromEntries(['fuel', 'vessel'].map((f) => [`items.${f}`, uneaten])),
  // entities.ex:227-232 receptacles: a container's; death.ex:137: no template's
  'items.capacity': (doc) =>
    uneaten(doc) && doc.container === true && (doc.location as Obj | undefined)?.in !== 'template',
  // skills.ex:230-231: an off-hand item's; skills.ex:245-256: the world's combat narrates a block
  'items.block_chance': (doc, world) =>
    uneaten(doc) && doc.slot === 'off_hand' && !!((world.combat as Obj)?.narration as Obj)?.block,
  'actions.duration': (d, w) => !w.time_policy && !/"status\.apply"/.test(JSON.stringify(d)), // INVALID_TIME_POLICY (scripted_actions.ex:88): the whole cartridge.json; duration_status (:94); ponytail: also hides it beside a permanent status, which status.ex:72 lets through
  'actions.craft': (doc) => (doc.target as Obj | undefined)?.kind !== 'spell', // replenish.ex:59
  'reactions.zone': (doc) => (doc.on as Obj | undefined)?.room === undefined, // ReactionRule: a zone forbids on.room
  'quests.repeatable': (doc) => doc.exchange !== undefined && !run(doc), // exchanges.ex:94-95
  'quests.offer': (doc) => !run(doc),
  'quests.deadline': (doc) => !run(doc),
  'quests.exchange': (doc) => !run(doc),
  'liquids.amount': (doc) => doc.resource !== undefined, // dependentRequired, defs.schema.json:11423
  'skills.hidden': (doc) => doc.prerequisite !== undefined, // dependentRequired, defs.schema.json:13641
  'skills.ranks': (doc) => Array.isArray(doc.growth), // skills.ex:107-108; card.ts SEEDS sizes it
  'items.intended_level': (doc) => doc.affects !== undefined, // derived.ex:70-71
  'populations.floor': (doc) => doc.chance === undefined && (doc.day_target as number) >= 1, // population.ex:117
  'populations.sight': (doc) => doc.member_role === 'prey', // population.ex:153
  'populations.trail': (_, world) => world.trails !== undefined, // trails.ex:140
  'populations.hunts': (_, world) => world.trails !== undefined,
  'dialogues.entry': (doc) => doc.keyword === undefined, // dialogue_links.ex:205-206; one per npc: the compile's
  'dialogues.keyword': (doc) => doc.entry === undefined && doc.riddle === undefined, // keywords.ex:16
  'dialogues.name': (doc, _, hidden) => !teaches(doc, hidden), // skills.ex:157
  // keywords.ex:16; skills.ex:158; a quest or riddle ends the talk, so no then leaves it (dialogue_links.ex:394)
  'dialogues.riddle': (doc, _, hidden) =>
    doc.keyword === undefined && !teaches(doc, hidden) && !linked(doc),
  'dialogues.quest': (doc) => !linked(doc), // dialogue_links.ex:394
  // the quest's evidence names the mechanic and it has none of the others: expedition.ex:99-100, patrol.ex:18-19
  'quests.expedition': (doc) =>
    solo(doc, 'expedition', 'offer repeatable deadline exchange patrol'),
  'quests.patrol': (doc) => solo(doc, 'patrol', 'offer repeatable deadline exchange'),
};
function uneaten(doc: Obj) {
  // food.ex:43-46, the other way round
  return doc.edible === undefined;
}
const solo = (doc: Obj, by: string, not: string) =>
  (doc.objective as Obj | undefined)?.evidence === by &&
  !not.split(' ').some((f) => Object.hasOwn(doc, f));
// a patrol or expedition quest takes no offer, repeatable, deadline or exchange (the same lines, the other way)
const run = (doc: Obj) => Object.hasOwn(doc, 'patrol') || Object.hasOwn(doc, 'expedition');
const choicesOf = (doc: Obj) => Object.values((doc.choices ?? {}) as Record<string, Obj>);
// skills.ex:166-170 teaches?: a choice's top-level step acquires a hidden skill (`hidden` are its keys)
export const teaches = (doc: Obj, hidden: string[]) =>
  choicesOf(doc).some((c) =>
    ((c.steps ?? []) as Obj[]).some((s) => hidden.includes(s.skill as string)),
  );
// a then or then_failed to a dialogue; `end` is never checked (dialogue_links.ex:402-404)
const linked = (doc: Obj) =>
  choicesOf(doc).some((c) => ['then', 'then_failed'].some((f) => c[f] && c[f] !== 'end'));

/** A field `added` seeds into the draft only: written with the author's pick (a targetless offer: quests.ex:63-66;
 * food without a restore, cure or status: food.ex:21 effect?). */
export const awaits = (def: string, f: string) =>
  ['source.QuestDefinition.offer', 'source.ItemDefinition.edible'].includes(`${def}.${f}`);
/** What the schema takes and the compiler refuses, as errors `apart` holds the fields by: food
 * with no restore, cure or status (food.ex:21 effect?, a `[]` none); an offer with no target (quests.ex:63-66). */
export const unready = (doc: Obj) => {
  const e = doc?.edible as Obj | undefined;
  const some = (v: unknown) => v != null && !(Array.isArray(v) && !v.length);
  return [
    ...(e && !['resource', 'cures', 'applies'].some((k) => some(e[k]))
      ? [{ property: '.edible', message: 'needs a resource, cures or applies' }]
      : []),
    ...(doc?.offer && !(doc.offer as Obj).target
      ? [{ property: '.offer', message: 'needs a target' }]
      : []),
  ];
};

/** The menu's fields whose capability `requires.capabilities` (`caps`) declares and whose other needs
 * the definition (`doc`), cartridge.json's `world` and the hidden skills' keys meet; others would not compile. */
export const allowed = (
  kind: string,
  menu: string[],
  caps: object,
  doc: Obj = {},
  world: Obj = {},
  hidden: string[] = [],
) =>
  menu.filter((f) => {
    const owners = OWNERS[`${kind}.${f}`]?.split(' ') ?? [];
    const need = NEEDS[`${kind}.${f}`];
    return owners.every((o) => Object.hasOwn(caps, o)) && (!need || need(doc, world, hidden));
  });

// rjsf names an added map row `newKey`, which requires.capabilities refuses (requires.ex:52
// UNKNOWN_CAPABILITY): the row takes the registry's first portable capability not yet listed, at its version
export const capabilityRow = (doc: Obj) => {
  const caps = ((doc.requires as Obj | undefined)?.capabilities ?? {}) as Obj;
  if (!Object.hasOwn(caps, 'newKey')) return doc;
  const { newKey: _row, ...rest } = caps;
  const next = REGISTRY.find((c) => c.portability !== 'server_only' && !Object.hasOwn(rest, c.key));
  if (!next) return doc; // every capability listed: the schema refuses newKey at the field
  return {
    ...doc,
    requires: { ...(doc.requires as Obj), capabilities: { ...rest, [next.key]: next.version } },
  };
};
