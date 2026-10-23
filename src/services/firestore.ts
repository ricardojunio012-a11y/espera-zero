import {
  Timestamp, collection, doc, getDocs, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore'
import type { DocumentData, Firestore } from 'firebase/firestore'
import { UNIDADES } from '@espera-zero/shared'
import type { AgendaDia, AgendaPorUnidade, Alerta, Checkin, DiaSemana, Unidade } from '@espera-zero/shared'
import { conectar, garantirUid } from './firebase'
import type { ConexaoFirebase } from './firebase'
import type { NovoCheckin, Painel, Servicos } from './servicos'

const JANELA_MS = 1_800_000
const DUAS_HORAS_MS = 2 * 60 * 60 * 1000

function iso(valor: unknown): string {
  if (valor instanceof Timestamp) return valor.toDate().toISOString()
  return typeof valor === 'string' ? valor : new Date(0).toISOString()
}

async function lerUnidades(db: Firestore): Promise<Unidade[]> {
  const snap = await getDocs(collection(db, 'unidades'))
  // Before the first PBH sync the collection is empty; the bundled copy is the
  // last valid import (RN-21), not an invented list.
  if (snap.empty) return UNIDADES
  return snap.docs.map((d) => ({ ...(d.data() as Unidade), slug: d.id }))
}

async function lerAgendas(db: Firestore, unidades: Unidade[]): Promise<AgendaPorUnidade> {
  const pares = await Promise.all(unidades.map(async (u) => {
    const snap = await getDocs(collection(db, 'unidades', u.slug, 'agenda'))
    const dias = snap.docs.map((d): AgendaDia => {
      const dados = d.data()
      return {
        dia: d.id as DiaSemana,
        horarios: dados.horarios ?? {},
        origem: dados.origem ?? 'grupo',
        atualizadoEm: iso(dados.atualizadoEm),
      }
    })
    return [u.slug, dias] as const
  }))
  return Object.fromEntries(pares)
}

function paraCheckin(dados: DocumentData): Checkin {
  return {
    slug: dados.slug,
    especialidade: dados.especialidade,
    minutos: dados.minutos,
    janela: dados.janela,
    risco: dados.risco,
    criadoEm: iso(dados.criadoEm),
  }
}

async function lerCheckins(db: Firestore, agora: Date): Promise<Checkin[]> {
  const desde = Timestamp.fromMillis(agora.getTime() - DUAS_HORAS_MS)
  const snap = await getDocs(query(collection(db, 'checkins'), where('criadoEm', '>=', desde)))
  return snap.docs.map((d) => paraCheckin(d.data()))
}

async function lerAlertas(db: Firestore, agora: Date): Promise<Alerta[]> {
  const snap = await getDocs(query(collection(db, 'alertas'), where('expiraEm', '>', Timestamp.fromDate(agora))))
  return snap.docs.map((d) => {
    const dados = d.data()
    return { ...(dados as Alerta), criadoEm: iso(dados.criadoEm), expiraEm: iso(dados.expiraEm) }
  })
}

export function criarServicosFirestore(obterConexao: () => Promise<ConexaoFirebase> = conectar): Servicos {
  return {
    async carregarPainel(agora: Date): Promise<Painel> {
      const { db } = await obterConexao()
      const unidades = await lerUnidades(db)
      const [agendas, checkins, alertas] = await Promise.all([
        lerAgendas(db, unidades),
        lerCheckins(db, agora),
        lerAlertas(db, agora),
      ])
      // Emulator data comes from `npm run semear`, so it is labelled simulated too.
      return { unidades, checkins, agendas, alertas, simulado: import.meta.env.VITE_USE_EMULATOR === 'true' }
    },

    /**
     * RN-13: written once, at "Fui atendido", with the whole wait. The id
     * carries the 30-minute window, so the rules allow one per device per UPA.
     */
    async registrarCheckin(novo: NovoCheckin): Promise<void> {
      const { db, auth } = await obterConexao()
      const uid = await garantirUid(auth)
      const janela = Math.floor(Date.now() / JANELA_MS)
      const dados: Record<string, unknown> = {
        slug: novo.slug,
        uid,
        especialidade: novo.especialidade,
        janela,
        minutos: novo.minutos,
        criadoEm: serverTimestamp(),
      }
      if (novo.risco) dados.risco = novo.risco
      await setDoc(doc(db, 'checkins', `${novo.slug}_${uid}_${janela}`), dados)
    },
  }
}
