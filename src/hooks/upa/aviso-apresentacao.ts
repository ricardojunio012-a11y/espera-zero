import { ptBR } from '../../i18n/pt-BR'
import type { Alerta } from '../../services/tipos-provisorios'

/** Título do aviso, com os mesmos textos do sheet "Avisar algo" (tela 15). */
export function tituloDoAviso(a: Alerta): string {
  const t = ptBR.aviso
  switch (a.tipo) {
    case 'tem-profissional':
      return a.especialidade ? t.temProfissional(a.especialidade) : t.temProfissionalGeral
    case 'sem-profissional':
      return a.especialidade ? t.semProfissional(a.especialidade) : t.semProfissionalGeral
    case 'outro':
      return a.texto?.trim() || t.outro
    default:
      return t[a.tipo]
  }
}

/** Define o ícone: positivo (✔), problema (!) ou informação (i). */
export type TomDoAviso = 'positivo' | 'problema' | 'info'

export function tomDoAviso(a: Alerta): TomDoAviso {
  if (a.tipo === 'tem-profissional') return 'positivo'
  if (a.tipo === 'sem-profissional' || a.tipo === 'raio-x' || a.tipo === 'farmacia') return 'problema'
  return 'info'
}

export function minutosParaExpirar(a: Alerta, agoraMs: number): number {
  return Math.max(0, Math.ceil((Date.parse(a.expiraEm) - agoraMs) / 60_000))
}
