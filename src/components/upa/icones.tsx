// Ícones decorativos da tela da UPA (traço simples, herdam a cor do texto).
// Todos são aria-hidden: o significado sempre vem de um texto ao lado.
// TODO(T15): trocar pelo conjunto de ícones do design system quando existir.

const base = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

export const IconeVoltar = () => (
  <svg {...base}>
    <path d="m15 5-7 7 7 7" />
  </svg>
)

export const IconeCompartilhar = () => (
  <svg {...base}>
    <path d="M12 15V4m0 0L8 8m4-4 4 4M5 13v6h14v-6" />
  </svg>
)

export const IconePino = () => (
  <svg {...base}>
    <path d="M12 21s-6-5.6-6-10.5a6 6 0 0 1 12 0C18 15.4 12 21 12 21Z" />
    <circle cx="12" cy="10.5" r="2" />
  </svg>
)

export const IconeCheck = () => (
  <svg {...base}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

export const IconeAlerta = () => (
  <svg {...base}>
    <path d="M12 7v6m0 4h.01" />
  </svg>
)

export const IconeInfo = () => (
  <svg {...base}>
    <path d="M12 11v6m0-10h.01" />
  </svg>
)

export const IconePessoas = () => (
  <svg {...base}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19c.5-3 2.7-4.5 5.5-4.5s5 1.5 5.5 4.5M16 5.3a3 3 0 0 1 0 5.4M17.5 14.7c1.7.6 2.8 2 3 4.3" />
  </svg>
)
