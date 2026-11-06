// rjsf's core templates in the editor chrome (docs/design/editor-chrome-rulings.md): its own
// buttons draw a glyphicon font the panel does not load (a 0x0 box), its labels and errors are
// unstyled. Inputs and selects keep rjsf's widgets (they own the value coercion) and take the
// `form-control` rule in index.css.
import {
  getTemplate,
  getUiOptions,
  type DescriptionFieldProps,
  type FieldErrorProps,
  type FieldTemplateProps,
  type IconButtonProps,
  type TitleFieldProps,
} from '@rjsf/utils';
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Copy,
  Plus,
  X,
  type LucideIcon,
} from 'lucide-react';
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

/** The required mark: dim, and not read out (the input itself carries `required`). */
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
      <div
        className={`grid gap-0.5 ${rawErrors?.length ? '[&_:is(input,select,textarea)]:border-destructive' : ''}`}
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

/** An object's legend; an array item's (`attributes-1`) is for a reader only, as above. */
function TitleFieldTemplate({ id, title, required }: TitleFieldProps) {
  const item = /-\d+$/.test(title);
  return (
    <legend id={id} className={item ? 'sr-only' : 'text-xs font-medium'}>
      {title}
      {required && !item ? <Required /> : null}
    </legend>
  );
}

/** One dim line; the whole text in its tooltip and, by its id, the input's description. */
function DescriptionFieldTemplate({ id, description }: DescriptionFieldProps) {
  if (!description) return null;
  return (
    <div
      id={id}
      className="truncate text-xs text-muted-foreground"
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
const FieldErrorTemplate = ({ errors = [] }: FieldErrorProps) => (
  <>
    {errors.filter(Boolean).map((e, i) => (
      <Refusal key={i}>{e}</Refusal>
    ))}
  </>
);

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
