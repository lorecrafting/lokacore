// sksl-transformer.cjs bundles a .sksl file as its source text.
declare module '*.sksl' {
  const source: string;
  export default source;
}
