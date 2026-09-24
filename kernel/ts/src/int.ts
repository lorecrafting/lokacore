// Checked rule-critical integer arithmetic (docs/spec/conformance/numeric-profile.md).
// Operands and results stay in [-(2^53 - 1), 2^53 - 1]; leaving it is KernelError
// ('integer_overflow'), never wraparound or silent rounding.
import { SAFE } from './canonical.ts';
import { KernelError } from './error.ts';

const operand = (n: number): number => (Number.isSafeInteger(n) ? n : overflow());
const overflow = (): never => {
  throw new KernelError('integer_overflow');
};

// For safe operands an exact result within range is representable, so the double is exact;
// an exact result beyond 2^53 - 1 rounds (monotonically) to at least 2^53, still out of
// range. So checking the computed double loses no precision, even for mul's 106-bit products.
const check = (n: number): number => (Math.abs(n) <= SAFE ? n + 0 : overflow());

export const add = (a: number, b: number): number => check(operand(a) + operand(b));
export const sub = (a: number, b: number): number => check(operand(a) - operand(b));
export const mul = (a: number, b: number): number => check(operand(a) * operand(b));

/** [quotient truncated toward zero, remainder a - q*b]; a zero divisor throws 'division_by_zero'. */
export function divide(a: number, b: number): [number, number] {
  operand(a);
  if (operand(b) === 0) throw new KernelError('division_by_zero');
  const r = a % b; // exact for doubles, and (a - r) / b divides evenly
  return [(a - r) / b + 0, r + 0];
}
