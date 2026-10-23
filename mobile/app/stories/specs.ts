// Each exported Book component's spec, its doc comment (BOOK-UI-COMPONENTS.md, Component
// catalogue), read from source text: catalogue.test.ts checks it, the Docs/Component specs page
// shows it.

// A function, const or `{ X as Name }` export of a capitalised name. Any other capitalised export
// form goes to `unknown`, so the scan cannot silently miss one.
const EXPORT = /^export (?:(?:default )?(?:function|const) ([A-Z]\w*)|\{ \w+ as ([A-Z]\w*) \})/gm;
const KNOWN =
  /^export (?:(?:default )?function \w+|(?:default )?const \w+ =|(?:type|interface)\b|\{ \w+ as [A-Z]\w* \}|\{ [a-z]\w* \})/;
const MULTI = /^export (?:default )?const .*, [A-Z]\w* =/; // `export const A = …, B = …`

/** `file` names the source (`book/Chip.tsx`); `doc` is the comment without its ` * ` prefixes. */
export function specs(file: string, src: string) {
  const unknown = [...src.matchAll(/^export .*/gm)]
    .filter(([line]) => !KNOWN.test(line) || MULTI.test(line))
    .map(([line]) => `${file}: ${line}`);
  const components = [...src.matchAll(EXPORT)].map((m) => ({
    file,
    name: m[1] ?? m[2]!,
    doc: (/\/\*\*((?:(?!\*\/)[^])*)\*\/\s*$/.exec(src.slice(0, m.index))?.[1] ?? '').replace(
      /^ \*( |$)/gm,
      '',
    ),
  }));
  return { components, unknown };
}
