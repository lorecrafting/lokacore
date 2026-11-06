// rjsf's core templates in the editor chrome (docs/design/editor-chrome-rulings.md): its own
// buttons draw a glyphicon font the panel does not load (a 0x0 box), its labels and errors are
// unstyled. Inputs and selects keep rjsf's widgets (they own the value coercion) and take the
// `form-control` rule in index.css.
import {
  errorId,
  getTemplate,
  getUiOptions,
  type DescriptionFieldProps,
  type FieldErrorProps,
  type FieldTemplateProps,
  type IconButtonProps,
  type ObjectFieldTemplateProps,
  type TitleFieldProps,
} from '@rjsf/utils';
import { ArrowDown, ArrowUp, CircleAlert, Copy, Plus, X, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { FormProps } from '@rjsf/core';
import { Button } from '../components/ui/button.tsx';

/** A 24px ghost icon button with a 16px icon, named by its aria-label and tooltip. */
const icon = (Icon: LucideIcon, name: string) =>
  function IconButton({ id, onClick, disabled, style }: IconButtonProps) {
    return (
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        id={id}
        aria-label={name}
        title={name}
        onClick={onClick}
        disabled={disabled}
        style={style}
      >
        <Icon className="size-4" aria-hidden />
      </Button>
    );
  };

/** The required mark: dim, and not read out (a native input carries `required`; a legend adds sr-only text). */
const Required = () => (
  <span aria-hidden className="text-muted-foreground">
    {' *'}
  </span>
);

function FieldTemplate(p: FieldTemplateProps) {
  const { id, label, children, errors, help, description, hidden, required } = p;
  const { displayLabel, rawErrors, registry, uiSchema, fieldPathId } = p;
  const uiOptions = getUiOptions(uiSchema);
  const Wrap = getTemplate('WrapIfAdditionalTemplate', registry, uiOptions);
  if (hidden) return <div className="hidden">{children}</div>;
  // rjsf labels an array item `keywords-1`: its list already names it, so only a reader hears it
  const item = typeof fieldPathId.path.at(-1) === 'number';
  const show = displayLabel && uiOptions.widget !== 'checkbox';
  return (
    <Wrap {...p}>
      {/* grid-cols-1 is minmax(0,1fr): an auto track would widen to a long text key and push the card past the inspector */}
      <div
        className={`grid grid-cols-1 gap-0.5 ${displayLabel ? 'group' : ''} ${rawErrors?.length ? '[&>.form-control]:border-destructive [&>label>input]:border-destructive' : ''}`}
      >
        {show ? (
          <label htmlFor={id} className={item ? 'sr-only' : 'text-xs text-muted-foreground'}>
            {item ? label.replace(/-(\d+)$/, ' $1') : label}
            {required && !item ? <Required /> : null}
          </label>
        ) : null}
        {displayLabel && !item ? description : null}
        {children}
        {errors}
        {help}
      </div>
    </Wrap>
  );
}

/** An object's legend; an array item's is for a reader only, as above. */
function TitleFieldTemplate({ id, title, required }: TitleFieldProps) {
  const item = /_\d+__title$/.test(id); // rjsf's titleId of an array item: root_attributes_0__title
  return (
    <legend id={id} className={item ? 'sr-only' : 'text-xs font-medium'}>
      {title}
      {required && !item ? (
        <>
          <Required />
          <span className="sr-only"> required</span>
        </>
      ) : null}
    </legend>
  );
}

/** One dim line, whole while its field has focus; the whole text in its tooltip and, by its id, the input's description. */
function DescriptionFieldTemplate({ id, description }: DescriptionFieldProps) {
  if (!description) return null;
  return (
    <div
      id={id}
      className="truncate text-xs text-muted-foreground group-focus-within:whitespace-normal"
      title={typeof description === 'string' ? description : undefined}
    >
      {description}
    </div>
  );
}

/** A refusal: circle-alert and the message in `refusal`; boxed when it names no field. */
export const Refusal = ({ children, boxed }: { children: ReactNode; boxed?: boolean }) => (
  <p
    className={`flex items-start gap-1 text-destructive ${boxed ? 'rounded-md border border-destructive px-2 py-1' : ''}`}
  >
    <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
    {children}
  </p>
);

/** The refusals under their field. */
const FieldErrorTemplate = ({ errors = [], fieldPathId }: FieldErrorProps) => (
  <div id={errorId(fieldPathId)}>
    {errors.filter(Boolean).map((e, i) => (
      <Refusal key={i}>{e}</Refusal>
    ))}
  </div>
);

/** A map entry's fields with its optional absent ones folded (a new room detail, loka-wfrgk.76). */
export function Folded(p: ObjectFieldTemplateProps) {
  const Default = getTemplate('ObjectFieldTemplate', p.registry); // the registry's, not this one
  const required = (p.schema.required ?? []) as string[];
  const data = (p.formData ?? {}) as Record<string, unknown>;
  const open = p.properties.filter((x) => required.includes(x.name) || data[x.name] !== undefined);
  const rest = p.properties.filter((x) => !open.includes(x));
  return (
    <>
      <Default {...p} properties={open} />
      {rest.length ? (
        <details className="text-muted-foreground">
          <summary>Optional fields</summary>
          {rest.map((x) => x.content)}
        </details>
      ) : null}
    </>
  );
}

export const templates: FormProps['templates'] = {
  FieldTemplate,
  TitleFieldTemplate,
  DescriptionFieldTemplate,
  FieldErrorTemplate,
  ButtonTemplates: {
    AddButton: icon(Plus, 'Add'),
    RemoveButton: icon(X, 'Remove'),
    MoveUpButton: icon(ArrowUp, 'Move up'),
    MoveDownButton: icon(ArrowDown, 'Move down'),
    CopyButton: icon(Copy, 'Copy'),
  },
};
