import { deleteApp, initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { Timestamp, connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { criarServicosFirestore } from '../src/services/firestore'
import type { ConexaoFirebase } from '../src/services/firebase'

const PROJETO = 'demo-espera-zero'
let app: FirebaseApp
let conexao: ConexaoFirebase
let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJETO,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
  app = initializeApp({ projectId: PROJETO, apiKey: 'demo-api-key' }, 'servicos')
  const db = getFirestore(app)
  const auth = getAuth(app)
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  conexao = { app, db, auth }
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await deleteApp(app)
  await testEnv.cleanup()
})

const servicos = () => criarServicosFirestore(async () => conexao)

describe('Serviços no Firestore', () => {
  it('grava um check-in anônimo que as regras aceitam e que volta no painel', async () => {
    await servicos().registrarCheckin({ slug: 'oeste', especialidade: 'ortopedia', minutos: 42 })

    const painel = await servicos().carregarPainel(new Date())
    expect(painel.simulado).toBe(false)
    expect(painel.checkins).toHaveLength(1)
    expect(painel.checkins[0]).toMatchObject({ slug: 'oeste', especialidade: 'ortopedia', minutos: 42 })
  })

  it('recusa o segundo check-in do mesmo aparelho na mesma UPA e janela (RN-12)', async () => {
    await servicos().registrarCheckin({ slug: 'leste', especialidade: 'clinica', minutos: 30 })

    await expect(servicos().registrarCheckin({ slug: 'leste', especialidade: 'clinica', minutos: 31 }))
      .rejects.toThrow()
  })

  it('sem unidades sincronizadas, usa a última cópia da base da PBH', async () => {
    const painel = await servicos().carregarPainel(new Date())
    expect(painel.unidades).toHaveLength(9)
  })

  it('lê a agenda e deixa de fora check-ins com mais de 2 h', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'unidades/oeste/agenda/seg'), { horarios: { ortopedia: '24h' }, origem: 'grupo' })
      await setDoc(doc(db, 'checkins/velho'), {
        slug: 'oeste', uid: 'x', especialidade: 'ortopedia', janela: 1, minutos: 90,
        criadoEm: Timestamp.fromMillis(Date.now() - 3 * 60 * 60 * 1000),
      })
    })

    const painel = await servicos().carregarPainel(new Date())
    expect(painel.agendas.oeste).toEqual([expect.objectContaining({ dia: 'seg', horarios: { ortopedia: '24h' } })])
    expect(painel.checkins).toHaveLength(0)
  })
})
