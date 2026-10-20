import type { ComponentProps } from 'react';
import { splitInputClassName } from '@/lib/inputClassName';
import { cn } from '@/lib/utils';
import { TextareaField, TextareaRoot } from './textarea';

/** API piatta storica: box e stato sul guscio, tipografia sul campo. */
export function Textarea({ className, disabled, hasError, rows, ...props }: ComponentProps<typeof TextareaField> & { hasError?: boolean }) {
  const { root, field } = splitInputClassName(className);
  const ariaInvalid = props['aria-invalid'];
  const invalid = hasError ?? (ariaInvalid === undefined ? undefined : ariaInvalid !== false && ariaInvalid !== 'false');
  return (
    <TextareaRoot className={root} disabled={disabled} hasError={invalid}>
      <TextareaField className={cn('h-full', rows !== undefined && 'min-h-0', field)} disabled={disabled} rows={rows} {...props} />
    </TextareaRoot>
  );
}
