import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { Spinner } from './feedback';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  full?: boolean;
}

const SIZE_CLASS = { sm: 'px-3 py-2 text-[10px]', md: '', lg: 'px-7 py-4 text-xs' };

export function Button({ variant = 'primary', loading, size = 'md', icon, full, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${full ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
}

interface LinkButtonProps {
  to: string;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  full?: boolean;
  className?: string;
  children: ReactNode;
  external?: boolean;
}

export function LinkButton({ to, variant = 'primary', size = 'md', icon, full, className = '', children, external }: LinkButtonProps) {
  const cls = `${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${full ? 'w-full' : ''} ${className}`;
  if (external) {
    return (
      <a href={to} className={cls} target="_blank" rel="noreferrer">
        {icon}
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={cls}>
      {icon}
      {children}
    </Link>
  );
}
