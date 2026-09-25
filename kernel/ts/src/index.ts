// throwaway: CI trigger test, do not merge
// Portable rules kernel, TypeScript side of candidate C (ADR-071). Pure: no I/O,
// clock, randomness or Node APIs (lint/rules/ts-kernel-pure.yml). Rules arrive in R5.
export const KERNEL_ID = 'loka-kernel';
export { loadCartridge, type Installed, type LoadResult } from './cartridge.ts';
