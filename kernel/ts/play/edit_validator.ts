// The kind schema's verdict on an edited source file (docs/rnd/gui-editor-design-2026-11-04.md §11).
// Apart from edit_model.ts because Ajv is a dev dependency the play server never loads.
import Ajv2020 from 'ajv/dist/2020.js';
import { Refused } from './edit_model.ts';

const fail = (kind: string): never => {
  throw new Refused(`no source schema for ${kind}`);
};

/**
 * A checker over `schemas/source` (file name to schema, defs.schema.json included): a kind's file
 * after an edit to the errors, `instancePath message` each, `[]` when it is valid.
 */
export function validator(schemas: Record<string, object>) {
  const ajv = new Ajv2020({ allErrors: true });
  for (const [name, schema] of Object.entries(schemas)) ajv.addSchema(schema, name);
  return (kind: string, doc: unknown): string[] => {
    const valid = ajv.getSchema(`${kind}.schema.json`) ?? fail(kind);
    return valid(doc) ? [] : valid.errors!.map((e) => `${e.instancePath || '/'} ${e.message}`);
  };
}
