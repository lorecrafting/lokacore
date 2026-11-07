// The lines of the Credits page, from the audio manifest's rows.
export const creditsOf = (rows: readonly { credit?: string | null }[]) => [
  ...new Set(rows.flatMap((r) => (r.credit ? [r.credit] : []))),
];
