
import type { ReactNode } from 'react'


type ButtonProps = {
  children: ReactNode
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  onClick?: () => void
}

function Button({
  children,
  type = 'button',
  disabled = false,
  variant = 'primary',
  onClick,
}: ButtonProps) {
  const baseClasses =
    'rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      {children}
    </button>
  )
}

export default Button
