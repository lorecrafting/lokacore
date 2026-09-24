// Typed kernel failure; `code` is the portable error code shared with the Elixir kernel.
export class KernelError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
