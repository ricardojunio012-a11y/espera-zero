import type { CheckinLocal } from './checkin-local'

const MS_POR_MINUTO = 60_000
const LIMITE_INTERVALO_MS = 12 * 60 * MS_POR_MINUTO
const MAX_MINUTOS_REGISTRO = 360

export type ResultadoAjuste =
  | { ok: true; chegadaEm: string; atendidoEm?: string; minutos: number }
  | { ok: false; motivo: string }

const erro = (motivo: string): ResultadoAjuste => ({ ok: false, motivo })

/** Minutos inteiros desde a chegada. Nunca negativo (relógio mexido ou data inválida dão 0). */
export function minutosDesde(chegadaEm: string, agoraMs: number): number {
  const chegadaMs = Date.parse(chegadaEm)
  if (Number.isNaN(chegadaMs)) return 0
  return Math.max(0, Math.floor((agoraMs - chegadaMs) / MS_POR_MINUTO))
}

/** "mm:ss" até 59:59; a partir de 60 min, "h:mm:ss". */
export function formatarCronometro(ms: number): string {
  const totalSegundos = Math.max(0, Math.floor(ms / 1000))
  const horas = Math.floor(totalSegundos / 3600)
  const minutos = String(Math.floor((totalSegundos % 3600) / 60)).padStart(2, '0')
  const segundos = String(totalSegundos % 60).padStart(2, '0')
  return horas > 0 ? `${horas}:${minutos}:${segundos}` : `${minutos}:${segundos}`
}

/** Passou de 12 h desde a chegada (exatamente 12 h ainda vale). Data ilegível também conta como abandonado. */
export function checkinAbandonado(chegadaEm: string, agoraMs: number): boolean {
  const chegadaMs = Date.parse(chegadaEm)
  if (Number.isNaN(chegadaMs)) return true
  return agoraMs - chegadaMs > LIMITE_INTERVALO_MS
}

/**
 * Precisa mostrar a confirmação ("Está certo?" / "Ajustar")?
 * `abertoEmMs` é o instante em que o app foi aberto. Se a última confirmação é
 * anterior a isso (ou não existe), a pessoa acabou de voltar e ainda não confirmou.
 */
export function precisaConfirmar(checkin: CheckinLocal, abertoEmMs: number): boolean {
  if (!checkin.confirmadoEm) return true
  const confirmadoMs = Date.parse(checkin.confirmadoEm)
  if (Number.isNaN(confirmadoMs)) return true
  return confirmadoMs < abertoEmMs
}

function lerHora(texto: string): { horas: number; minutos: number } | null {
  const partes = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(texto.trim())
  if (!partes) return null
  return { horas: Number(partes[1]), minutos: Number(partes[2]) }
}

/**
 * Monta um instante a partir de "HH:mm" no relógio LOCAL do aparelho.
 * `deslocamentoDias` aceita -1 (ontem) e +1 (amanhã): o próprio Date acerta
 * virada de mês e de ano quando o dia sai do intervalo.
 */
function instanteLocal(base: Date, hora: { horas: number; minutos: number }, deslocamentoDias = 0): Date {
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + deslocamentoDias,
    hora.horas,
    hora.minutos,
    0,
    0,
  )
}

/**
 * Valida o ajuste feito na tela ("Ajustar"). As horas são digitadas no relógio do aparelho.
 * - Chegada: se a hora de hoje ainda não chegou, vale ontem (passou da meia-noite).
 * - Atendimento: se está antes da chegada no relógio, tenta o dia seguinte; hora futura é recusada.
 * - Intervalo máximo de 12 h; com atendimento, a espera final vai de 0 a 360 min.
 */
export function validarAjuste(
  entrada: { horaChegada: string; horaAtendimento?: string },
  agoraMs: number,
): ResultadoAjuste {
  const horaChegada = lerHora(entrada.horaChegada)
  if (!horaChegada) return erro('Digite a hora de chegada assim: 14:30.')

  const agora = new Date(agoraMs)
  let chegada = instanteLocal(agora, horaChegada)
  const virouOntem = chegada.getTime() > agoraMs
  if (virouOntem) chegada = instanteLocal(agora, horaChegada, -1)

  if (agoraMs - chegada.getTime() > LIMITE_INTERVALO_MS) {
    return erro(
      virouOntem
        ? 'Essa hora ainda não chegou hoje. Se foi ontem, já passaram mais de 12 horas e não dá para registrar.'
        : 'Essa chegada foi há mais de 12 horas e não dá para registrar. Confira a hora.',
    )
  }

  if (entrada.horaAtendimento === undefined) {
    return {
      ok: true,
      chegadaEm: chegada.toISOString(),
      minutos: minutosDesde(chegada.toISOString(), agoraMs),
    }
  }

  const horaAtendimento = lerHora(entrada.horaAtendimento)
  if (!horaAtendimento) return erro('Digite a hora do atendimento assim: 15:45.')

  let atendido = instanteLocal(chegada, horaAtendimento)
  if (atendido.getTime() < chegada.getTime()) {
    const diaSeguinte = instanteLocal(chegada, horaAtendimento, 1)
    if (diaSeguinte.getTime() - chegada.getTime() > LIMITE_INTERVALO_MS) {
      return erro('O atendimento não pode ser antes da chegada. Confira as horas.')
    }
    atendido = diaSeguinte
  }

  if (atendido.getTime() > agoraMs) {
    return erro('Essa hora de atendimento ainda não chegou. Confira a hora.')
  }

  const minutos = Math.floor((atendido.getTime() - chegada.getTime()) / MS_POR_MINUTO)
  if (minutos > MAX_MINUTOS_REGISTRO) {
    return erro('Não dá para registrar espera acima de 6 horas. Confira as horas.')
  }

  return {
    ok: true,
    chegadaEm: chegada.toISOString(),
    atendidoEm: atendido.toISOString(),
    minutos,
  }
}
