import type { RespostasTriagem } from '@espera-zero/shared'

export const PARA_QUEM: { id: RespostasTriagem['paraQuem']; texto: string }[] = [
  { id: 'eu', texto: 'Para mim' },
  { id: 'crianca', texto: 'Para uma criança' },
  { id: 'idoso', texto: 'Para uma pessoa idosa' },
  { id: 'outro', texto: 'Para outro adulto' },
]

/**
 * Closed list: each `valor` is the wording the rules in packages/shared
 * recognise (RN-02, RN-03). Changing a value changes the routing.
 */
export const SINTOMAS: { valor: string; texto: string; detalhe?: string }[] = [
  { valor: 'suspeita de fratura', texto: 'Queda, pancada ou torção', detalhe: 'pode ter quebrado ou trincado' },
  { valor: 'febre', texto: 'Febre' },
  { valor: 'dor persistente', texto: 'Dor que não passa', detalhe: 'barriga, cabeça, costas…' },
  { valor: 'dor de dente com rosto inchado', texto: 'Dor de dente com o rosto inchado' },
  { valor: 'sintoma leve', texto: 'Gripe, resfriado ou mal-estar leve' },
  { valor: 'receita', texto: 'Receita, atestado ou exame de rotina' },
  { valor: 'outro problema', texto: 'Outro problema' },
]

export const TEMPOS: { id: RespostasTriagem['tempo']; texto: string }[] = [
  { id: 'agora', texto: 'Começou agora' },
  { id: 'hoje', texto: 'Hoje' },
  { id: 'dias', texto: 'Há alguns dias' },
  { id: 'semanas', texto: 'Há semanas ou mais' },
]

export type Passo = 'para-quem' | 'alerta' | 'sintoma' | 'tempo'
export const PASSOS: Passo[] = ['para-quem', 'alerta', 'sintoma', 'tempo']

export interface Rascunho {
  passo: Passo | 'resultado'
  respostas: Partial<RespostasTriagem>
}

const CHAVE = 'ez.triagem'

/** RN-23: answers live only on this device, for this visit, and go on "refazer". */
export function lerRascunho(): Rascunho {
  try {
    const salvo = sessionStorage.getItem(CHAVE)
    if (salvo) return JSON.parse(salvo) as Rascunho
  } catch {
    // Unreadable or blocked storage: start over.
  }
  return { passo: 'para-quem', respostas: {} }
}

export function salvarRascunho(rascunho: Rascunho) {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(rascunho))
  } catch {
    // Private mode: the answers just aren't kept.
  }
}

export function apagarRascunho() {
  try {
    sessionStorage.removeItem(CHAVE)
  } catch {
    // Nothing kept, nothing to erase.
  }
}

export function completas(r: Partial<RespostasTriagem>): r is RespostasTriagem {
  return Boolean(r.paraQuem && r.sinaisAlerta && r.sintoma && r.tempo)
}
