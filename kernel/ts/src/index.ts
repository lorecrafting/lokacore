// Portable rules kernel, TypeScript side of candidate C (ADR-071). Pure: no I/O,
// clock, randomness or Node APIs (lint/rules/ts-kernel-pure.yml). Rules live in rules/.
export const KERNEL_ID = 'loka-kernel';
export { loadCartridge, type Installed, type LoadResult } from './cartridge.ts';
export { gameView, INSTALLED, newWorld, step } from './world.ts';
export type { Cartridge, World } from './decision.ts';
