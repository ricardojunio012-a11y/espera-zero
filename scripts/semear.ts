/**
 * Fills Firestore through the Admin SDK.
 *
 *   npm run semear -- --agenda              initial weekly board (allowed in production)
 *   npm run semear -- --unidades            the 9 UPAs from unidades.json
 *   npm run semear -- --checkins-simulados  fake waits; emulator only
 *
 * The initial board marks every specialty the reference file lists for a UPA
 * as 24 h, origin "grupo". It is the starting point the group corrects by
 * phone or visit (Escopo, premissas), not confirmed information.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { UNIDADES } from '../packages/shared/src/dados'
import { agendaSimulada, checkinsSimulados } from '../src/services/mock'

const args = new Set(process.argv.slice(2))
const noEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST)

if (args.has('--checkins-simulados') && !noEmulador) {
  // RN-24: a simulated wait must never reach the public as if it were real.
  console.error('Check-ins simulados só no emulador (defina FIRESTORE_EMULATOR_HOST).')
  process.exit(1)
}

const projectId = process.env.FIREBASE_PROJECT_ID ?? (noEmulador ? 'demo-espera-zero' : undefined)
const app = noEmulador ? initializeApp({ projectId }) : initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore(app)
const agora = new Date()

async function main() {
  const lote = db.batch()
  if (args.has('--unidades')) {
    for (const u of UNIDADES) lote.set(db.collection('unidades').doc(u.slug), u)
  }
  if (args.has('--agenda')) {
    for (const [slug, dias] of Object.entries(agendaSimulada(UNIDADES, agora))) {
      for (const dia of dias) {
        lote.set(db.collection('unidades').doc(slug).collection('agenda').doc(dia.dia), {
          horarios: dia.horarios, origem: dia.origem, atualizadoEm: Timestamp.fromDate(agora),
        })
      }
    }
  }
  if (args.has('--checkins-simulados')) {
    for (const [i, c] of checkinsSimulados(UNIDADES, agora).entries()) {
      lote.set(db.collection('checkins').doc(`${c.slug}_semente${i}_${c.janela}`), {
        ...c, uid: `semente${i}`, criadoEm: Timestamp.fromDate(new Date(c.criadoEm)),
      })
    }
  }
  await lote.commit()
  console.log(`Firestore ${noEmulador ? 'do emulador' : `do projeto ${projectId ?? '(padrão)'}`} semeado: ${[...args].join(' ') || 'nada pedido'}.`)
}

main().catch((erro: unknown) => {
  console.error(erro)
  process.exit(1)
})
