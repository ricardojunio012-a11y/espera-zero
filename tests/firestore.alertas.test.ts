import { readFileSync } from 'node:fs'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
} from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  doc,
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'

let testEnv: RulesTestEnvironment

const HORA = 60 * 60 * 1000
const daquiA = (ms: number) => Timestamp.fromMillis(Date.now() + ms)

function novoAlerta(autor: string, extra: Record<string, unknown> = {}) {
  return {
    slug: 'oeste',
    tipo: 'fila',
    autor,
    criadoEm: serverTimestamp(),
    expiraEm: daquiA(6 * HORA - 60_000),
    confirmacoes: 0,
    contestacoes: 0,
    ...extra,
  }
}

function novaSugestao(autor: string, extra: Record<string, unknown> = {}) {
  return {
    slug: 'oeste',
    especialidade: 'ortopedia',
    dias: ['seg', 'ter'],
    modo: 'horario',
    de: '07:00',
    ate: '19:00',
    autor,
    confirmacoes: 0,
    status: 'pendente',
    criadoEm: serverTimestamp(),
    ...extra,
  }
}

const comoUsuario = (uid: string): Firestore =>
  testEnv.authenticatedContext(uid).firestore() as unknown as Firestore

async function semear(caminho: string, dados: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, caminho), dados)
  })
}

function votarAlerta(db: Firestore, uid: string, voto: 'confirmo' | 'contesto') {
  const lote = writeBatch(db)
  lote.update(doc(db, 'alertas/a1'), {
    [voto === 'confirmo' ? 'confirmacoes' : 'contestacoes']: increment(1),
  })
  lote.set(doc(db, `alertas/a1/votos/${uid}`), { voto, criadoEm: serverTimestamp() })
  return lote.commit()
}

function confirmarSugestao(db: Firestore, uid: string, status: 'pendente' | 'vigente') {
  const lote = writeBatch(db)
  lote.update(doc(db, 'sugestoesQuadro/s1'), { confirmacoes: increment(1), status })
  lote.set(doc(db, `sugestoesQuadro/s1/votos/${uid}`), { criadoEm: serverTimestamp() })
  return lote.commit()
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

describe('Regras de alertas', () => {
  it('permite criar um alerta válido', async () => {
    await assertSucceeds(setDoc(doc(comoUsuario('u1'), 'alertas/a1'), novoAlerta('u1')))
  })

  it('rejeita alerta sem login', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as unknown as Firestore
    await assertFails(setDoc(doc(db, 'alertas/a1'), novoAlerta('u1')))
  })

  it('rejeita autor diferente do uid logado', async () => {
    await assertFails(setDoc(doc(comoUsuario('u1'), 'alertas/a1'), novoAlerta('outro')))
  })

  it('rejeita tipo fora da lista fechada', async () => {
    await assertFails(
      setDoc(doc(comoUsuario('u1'), 'alertas/a1'), novoAlerta('u1', { tipo: 'qualquer' })),
    )
  })

  it('aceita texto livre só no tipo "outro" e até 120 caracteres', async () => {
    const db = comoUsuario('u1')
    await assertSucceeds(
      setDoc(doc(db, 'alertas/a1'), novoAlerta('u1', { tipo: 'outro', texto: 'Sem senha hoje' })),
    )
    await assertFails(
      setDoc(doc(db, 'alertas/a2'), novoAlerta('u1', { tipo: 'outro', texto: 'x'.repeat(121) })),
    )
    await assertFails(
      setDoc(doc(db, 'alertas/a3'), novoAlerta('u1', { texto: 'texto em tipo fechado' })),
    )
  })

  it('limita a validade a 6 h, ou 12 h para "sem profissional"', async () => {
    const db = comoUsuario('u1')
    await assertFails(
      setDoc(doc(db, 'alertas/a1'), novoAlerta('u1', { expiraEm: daquiA(7 * HORA) })),
    )
    await assertSucceeds(
      setDoc(
        doc(db, 'alertas/a2'),
        novoAlerta('u1', {
          tipo: 'sem-profissional',
          especialidade: 'ortopedia',
          expiraEm: daquiA(12 * HORA - 60_000),
        }),
      ),
    )
  })

  it('rejeita alerta criado com contagem já preenchida', async () => {
    await assertFails(
      setDoc(doc(comoUsuario('u1'), 'alertas/a1'), novoAlerta('u1', { confirmacoes: 5 })),
    )
  })

  describe('votos', () => {
    beforeEach(async () => {
      await semear('alertas/a1', { ...novoAlerta('autor'), criadoEm: Timestamp.now() })
    })

    it('permite confirmar ou contestar uma vez', async () => {
      await assertSucceeds(votarAlerta(comoUsuario('u2'), 'u2', 'confirmo'))
      await assertSucceeds(votarAlerta(comoUsuario('u3'), 'u3', 'contesto'))
    })

    it('rejeita o segundo voto da mesma pessoa', async () => {
      const db = comoUsuario('u2')
      await assertSucceeds(votarAlerta(db, 'u2', 'confirmo'))
      await assertFails(votarAlerta(db, 'u2', 'confirmo'))
    })

    it('rejeita voto de quem criou o alerta', async () => {
      await assertFails(votarAlerta(comoUsuario('autor'), 'autor', 'confirmo'))
    })

    it('rejeita somar no contador sem registrar o voto', async () => {
      await assertFails(updateDoc(doc(comoUsuario('u2'), 'alertas/a1'), { confirmacoes: increment(1) }))
    })

    it('rejeita voto que soma no contador errado', async () => {
      const db = comoUsuario('u2')
      const lote = writeBatch(db)
      lote.update(doc(db, 'alertas/a1'), { contestacoes: increment(1) })
      lote.set(doc(db, 'alertas/a1/votos/u2'), { voto: 'confirmo', criadoEm: serverTimestamp() })
      await assertFails(lote.commit())
    })

    it('não permite apagar alerta', async () => {
      const db = comoUsuario('autor')
      const lote = writeBatch(db)
      lote.delete(doc(db, 'alertas/a1'))
      await assertFails(lote.commit())
    })
  })
})

describe('Regras de sugestões do quadro', () => {
  it('permite criar uma sugestão pendente válida', async () => {
    await assertSucceeds(setDoc(doc(comoUsuario('u1'), 'sugestoesQuadro/s1'), novaSugestao('u1')))
  })

  it('aceita "24h" sem horário e rejeita horário inválido', async () => {
    const db = comoUsuario('u1')
    const semHorario: Record<string, unknown> = novaSugestao('u1', { modo: '24h' })
    delete semHorario.de
    delete semHorario.ate
    await assertSucceeds(setDoc(doc(db, 'sugestoesQuadro/s1'), semHorario))
    await assertFails(setDoc(doc(db, 'sugestoesQuadro/s2'), novaSugestao('u1', { de: '25:00' })))
  })

  it('rejeita sugestão que já nasce vigente', async () => {
    await assertFails(
      setDoc(doc(comoUsuario('u1'), 'sugestoesQuadro/s1'), novaSugestao('u1', { status: 'vigente' })),
    )
  })

  describe('confirmações', () => {
    beforeEach(async () => {
      await semear('sugestoesQuadro/s1', { ...novaSugestao('autor'), criadoEm: Timestamp.now() })
    })

    it('fica pendente até a terceira confirmação e vira vigente nela', async () => {
      await assertSucceeds(confirmarSugestao(comoUsuario('u1'), 'u1', 'pendente'))
      await assertSucceeds(confirmarSugestao(comoUsuario('u2'), 'u2', 'pendente'))
      await assertFails(confirmarSugestao(comoUsuario('u3'), 'u3', 'pendente'))
      await assertSucceeds(confirmarSugestao(comoUsuario('u3'), 'u3', 'vigente'))
    })

    it('não deixa marcar vigente antes da hora', async () => {
      await assertFails(confirmarSugestao(comoUsuario('u1'), 'u1', 'vigente'))
    })

    it('rejeita confirmação de quem sugeriu', async () => {
      await assertFails(confirmarSugestao(comoUsuario('autor'), 'autor', 'pendente'))
    })

    it('rejeita a mesma pessoa confirmando duas vezes', async () => {
      const db = comoUsuario('u1')
      await assertSucceeds(confirmarSugestao(db, 'u1', 'pendente'))
      await assertFails(confirmarSugestao(db, 'u1', 'pendente'))
    })
  })
})
