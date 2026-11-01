import { useState, type ReactNode } from 'react'
import type { Servicos } from './contrato-servicos'
import { criarServicosPadrao } from './escolher'
import { ServicosContexto } from './servicos-contexto'

interface Props {
  /** Injeta uma instância (testes de tela). Sem ela, usa VITE_DATA_SOURCE. */
  servicos?: Servicos
  children: ReactNode
}

export function ServicosProvider({ servicos, children }: Props) {
  // useState com função cria a instância uma única vez por provider, mesmo em StrictMode
  // (que renderiza duas vezes) ou quando o pai re-renderiza.
  const [instancia] = useState(() => servicos ?? criarServicosPadrao())
  return <ServicosContexto.Provider value={instancia}>{children}</ServicosContexto.Provider>
}
