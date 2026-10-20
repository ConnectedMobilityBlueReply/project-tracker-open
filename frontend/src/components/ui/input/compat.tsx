import type { ComponentProps } from 'react';
import { splitInputClassName } from '@/lib/inputClassName';
import { cn } from '@/lib/utils';
import { InputField, InputRoot } from './input';

/** API piatta storica: box e stato sul guscio, tipografia sul campo. */
export function Input({ className, disabled, hasError, ...props }: ComponentProps<typeof InputField> & { hasError?: boolean }) {
  const { root, field } = splitInputClassName(className);
  const ariaInvalid = props['aria-invalid'];
  const invalid = hasError ?? (ariaInvalid === undefined ? undefined : ariaInvalid !== false && ariaInvalid !== 'false');
  return (
    <InputRoot className={root} disabled={disabled} hasError={invalid}>
      <InputField className={cn('h-full', field)} disabled={disabled} {...props} />
    </InputRoot>
  );
}
