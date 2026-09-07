import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className = '',
  htmlFor,
}: FieldProps) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="text-gold"> *</span> : null}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export function Input({
  label,
  hint,
  error,
  wrapperClassName,
  className = '',
  id,
  required,
  ...rest
}: InputProps) {
  const inputId = id ?? rest.name;
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
      htmlFor={inputId}
    >
      <input
        id={inputId}
        className={`input ${error ? 'border-danger' : ''} ${className}`}
        aria-invalid={Boolean(error)}
        required={required}
        {...rest}
      />
    </Field>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export function Textarea({
  label,
  hint,
  error,
  wrapperClassName,
  className = '',
  id,
  required,
  ...rest
}: TextareaProps) {
  const inputId = id ?? rest.name;
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
      htmlFor={inputId}
    >
      <textarea
        id={inputId}
        className={`input min-h-28 ${error ? 'border-danger' : ''} ${className}`}
        aria-invalid={Boolean(error)}
        required={required}
        {...rest}
      />
    </Field>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export function Select({
  label,
  hint,
  error,
  wrapperClassName,
  className = '',
  options,
  placeholder,
  id,
  required,
  ...rest
}: SelectProps) {
  const inputId = id ?? rest.name;
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
      htmlFor={inputId}
    >
      <select
        id={inputId}
        className={`input cursor-pointer ${error ? 'border-danger' : ''} ${className}`}
        aria-invalid={Boolean(error)}
        required={required}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  error?: string;
}

export function Checkbox({ label, error, className = '', id, ...rest }: CheckboxProps) {
  const inputId = id ?? rest.name;
  return (
    <div>
      <label
        htmlFor={inputId}
        className={`flex cursor-pointer items-start gap-2.5 text-sm text-ivory/90 ${className}`}
      >
        <input
          id={inputId}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-gold"
          {...rest}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface RadioCardProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: ReactNode;
  description?: ReactNode;
  right?: ReactNode;
  disabled?: boolean;
}

export function RadioCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  right,
  disabled,
}: RadioCardProps) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-sm border p-3.5 transition-colors ${
        checked ? 'border-gold bg-spruce/60' : 'border-line hover:border-line-strong'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        disabled={disabled}
        className="accent-gold"
      />
      <span className="flex-1">
        <span className="block text-sm font-medium text-cream">{title}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      {right && <span className="text-sm font-medium text-gold">{right}</span>}
    </label>
  );
}

export function QuantityInput({
  value,
  onChange,
  min = 1,
  max = 99,
  size = 'md',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
}) {
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-2 text-sm';
  return (
    <div className="inline-flex items-center rounded-sm border border-line-strong bg-dark">
      <button
        type="button"
        aria-label="Diminuir"
        className={`${pad} text-ivory/70 hover:text-gold disabled:opacity-40`}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
      >
        −
      </button>
      <span className={`${pad} min-w-8 text-center font-semibold`}>{value}</span>
      <button
        type="button"
        aria-label="Aumentar"
        className={`${pad} text-ivory/70 hover:text-gold disabled:opacity-40`}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}
