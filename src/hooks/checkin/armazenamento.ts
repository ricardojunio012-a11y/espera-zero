import { CORES_RISCO, ESPECIALIDADES, type CheckinLocal } from './checkin-local'

const CHAVE = 'ez.checkin'

const ehIso = (valor: unknown): valor is string =>
  typeof valor === 'string' && !Number.isNaN(Date.parse(valor))

/** Confere o formato e devolve só os campos conhecidos; qualquer outra coisa vira null. */
function lerFormato(dado: unknown): CheckinLocal | null {
  if (typeof dado !== 'object' || dado === null) return null
  const d = dado as Record<string, unknown>

  if (typeof d.slug !== 'string' || d.slug === '') return null
  if (!ESPECIALIDADES.some((e) => e === d.especialidade)) return null
  if (!ehIso(d.chegadaEm)) return null
  if (d.risco !== undefined && !CORES_RISCO.some((c) => c === d.risco)) return null
  if (d.confirmadoEm !== undefined && !ehIso(d.confirmadoEm)) return null

  return {
    slug: d.slug,
    especialidade: d.especialidade as CheckinLocal['especialidade'],
    chegadaEm: d.chegadaEm,
    ...(d.risco !== undefined && { risco: d.risco as CheckinLocal['risco'] }),
    ...(d.confirmadoEm !== undefined && { confirmadoEm: d.confirmadoEm }),
  }
}

/** Lê o check-in em andamento. Armazenamento bloqueado, vazio ou com lixo devolve null. */
export function lerCheckin(): CheckinLocal | null {
  try {
    const texto = localStorage.getItem(CHAVE)
    if (texto === null) return null
    return lerFormato(JSON.parse(texto))
  } catch {
    return null
  }
}

/** Grava o check-in. Devolve false se o armazenamento falhou (o chamador decide se avisa). */
export function salvarCheckin(checkin: CheckinLocal): boolean {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(checkin))
    return true
  } catch {
    return false
  }
}

/** Apaga o check-in. Falha em silêncio. */
export function apagarCheckin(): void {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // armazenamento bloqueado: nada a apagar
  }
}
