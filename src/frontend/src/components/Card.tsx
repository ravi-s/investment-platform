import type { ReactNode } from 'react'

type CardProps = {
  title?: string
  children: ReactNode
}

function Card({ title, children }: CardProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {title && (
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          {title}
        </h3>
      )}

      {children}
    </section>
  )
}

export default Card