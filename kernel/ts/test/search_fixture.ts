// Search fragment: the frozen journal_sampler KAT (quests lantern and oar, Ferry Landing north to the
// Village Green) plus inline notices: a titled tracks notice at the landing, and on the green a
// rumor board over two readable notices. A reaction starts the oar quest when the lantern quest
// resolves with outcome carry.
import { fragment } from './fragment.ts';

const f = fragment('protocol/fixtures/cartridge_journal_hash.json');
export const { ref, prefix } = f;

export function searchSource(c: any) {
  c.manifest.requires.kernel_api.at_least = '1.8';
  for (const caps of [c.manifest.requires.capabilities, c.lock.capabilities])
    Object.assign(caps, { readable: 1, reaction: 1 });
  c.facts[`${prefix}:fact/tracks_found`] = {
    key: 'tracks_found',
    version: 1,
    value_type: { type: 'bool', default: false },
    scopes: ['player'],
    meaning: 'The player studied the tracks.',
  };
  c.reactions = {
    [`${prefix}:reaction/start_search`]: {
      key: 'start_search',
      on: { event: 'quest_resolved', quest: ref('quest', 'lantern'), outcome: 'carry' },
      steps: [{ op: 'quest.activate', quest: ref('quest', 'oar') }],
    },
  };
  const read = (name: string, title?: string) => ({
    aliases: [name],
    description: `detail.${name}.description`,
    readable: { label: `actions.read_${name}`, text: `readable.${name}`, ...(title && { title }) },
  });
  Object.assign(c.rooms[`${prefix}:room/ferry_landing`].details, {
    tracks: read('tracks', 'detail.tracks.title'),
  });
  c.rooms[`${prefix}:room/village_green`].details = {
    rumor_board: {
      aliases: ['rumor_board', 'board'],
      description: 'detail.rumor_board.description',
      notice_board: {
        title: 'detail.rumor_board.title',
        notices: [
          { detail: 'lost_whistle', title: 'detail.lost_whistle.title' },
          { detail: 'cellar_help', title: 'detail.cellar_help.title' },
        ],
      },
    },
    lost_whistle: read('lost_whistle'),
    cellar_help: read('cellar_help'),
  };
  const text: Record<string, string> = {
    'detail.rumor_board.description': 'A rumor board.',
    'detail.rumor_board.title': 'Rumors',
    'actions.study_tracks': 'Study',
    'narration.study_tracks': 'You study the tracks.',
  };
  for (const name of ['tracks', 'lost_whistle', 'cellar_help'])
    Object.assign(text, {
      [`detail.${name}.description`]: `The ${name}.`,
      [`detail.${name}.title`]: name,
      [`actions.read_${name}`]: `Read ${name}`,
      [`readable.${name}`]: `It reads ${name}.`,
    });
  Object.assign(c.text, text);
}
const withSearch =
  (change: (c: any) => void = () => {}) =>
  (c: any) => {
    searchSource(c);
    change(c);
  };
export const load = (change?: (c: any) => void) => f.load(withSearch(change));
export const genesis = (change?: (c: any) => void) => f.genesis(withSearch(change));
