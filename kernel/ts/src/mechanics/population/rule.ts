import type { Rule } from '../../runtime/decision.ts';
import { shoo } from '../crow/behavior.ts';

export const decide: Rule<'population'> = (world, command, mint) => shoo(world, command, mint);
