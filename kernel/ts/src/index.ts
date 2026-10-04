// Portable rules kernel, TypeScript side of candidate C (ADR-071). Pure: no I/O,
// clock, randomness or Node APIs (lint/rules/ts-kernel-pure.yml). Rules live in mechanics/*/rule.ts.
export const KERNEL_ID = 'loka-kernel';
export { loadCartridge, type Installed, type LoadResult } from './content/cartridge.ts';
export { gameView, INSTALLED, newWorld, step } from './runtime/world.ts';
export type { Cartridge, World } from './runtime/decision.ts';
