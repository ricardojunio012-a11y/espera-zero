
import { readFileSync } from 'node:fs'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
} from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import {
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'

let testEnv: RulesTestEnvironment

const janelaAtual = () => Math.floor(Date.now() / 1_800_000)


function criarCheckin(uid: string, janela: number, minutos: number) {
  return {
    slug: 'oeste',
    uid,
    especialidade: 'ortopedia',
    janela,
    minutos,
    criadoEm: serverTimestamp(),
  }
}


beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-espera-zero',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('Regras de segurança do Firestore', () => {
  it('permite um check-in válido', async () => {
    const uid = 'usuario-1'
    const janela = janelaAtual()
    const db = testEnv.authenticatedContext(uid).firestore()

    await assertSucceeds(
      setDoc(
        doc(db, `checkins/oeste_${uid}_${janela}`),
        criarCheckin(uid, janela, 40),
      ),
    )
  })

  it('rejeita um segundo check-in na mesma janela', async () => {
    const uid = 'usuario-1'
    const janela = janelaAtual()
    const db = testEnv.authenticatedContext(uid).firestore()
    const referencia = doc(db, `checkins/oeste_${uid}_${janela}`)

    await assertSucceeds(
      setDoc(referencia, criarCheckin(uid, janela, 40)),
    )

    await assertFails(
      setDoc(referencia, criarCheckin(uid, janela, 50)),
    )
  })

  it('rejeita minutos fora do intervalo permitido', async () => {
    const uid = 'usuario-2'
    const janela = janelaAtual()
    const db = testEnv.authenticatedContext(uid).firestore()

    await assertFails(
      setDoc(
        doc(db, `checkins/oeste_${uid}_${janela}`),
        criarCheckin(uid, janela, 361),
      ),
    )
  })

  it('rejeita escrita direta na coleção unidades', async () => {
    const db = testEnv.authenticatedContext('usuario-3').firestore()

    await assertFails(
      setDoc(doc(db, 'unidades/oeste'), {
        nome: 'UPA Oeste',
      }),
    )
  })
})
