/**
 * RF-25 / ADR-006: imports the official UPA list from the PBH open data portal.
 *
 *   npm run sync:pbh                       checks only; fails if the format changed
 *   npm run sync:pbh -- --json             also refreshes packages/shared/data/unidades.json
 *   npm run sync:pbh -- --firestore        also writes unidades/ through the Admin SDK
 *
 * Address and coordinate differences are reported, never applied on their
 * own: Barreiro and Oeste run from temporary addresses during works, and the
 * PBH base still lists the old buildings. Pass --aplicar-divergencias to take
 * the PBH values anyway.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import type { Unidade } from '../packages/shared/src/tipos'
import { baixarCsv, compararComBase, DATASET, lerUpas, recursoMaisRecente } from './pbh'
import type { Divergencia, Recurso, UpaPbh } from './pbh'

const ARQUIVO = new URL('../packages/shared/data/unidades.json', import.meta.url)
const args = new Set(process.argv.slice(2))

function aplicar(base: Unidade[], pbh: UpaPbh[], recurso: Recurso, comDivergencias: boolean): Unidade[] {
  return base.map((u) => {
    const p = pbh.find((x) => x.slug === u.slug)
    if (!p) return u
    const atualizada: Unidade = { ...u, fontePbh: { id: `${DATASET}:${p.idPbh}`, atualizadoEm: recurso.atualizadoEm } }
    if (comDivergencias) {
      atualizada.lat = p.lat
      atualizada.lng = p.lng
      atualizada.fonteCoordenadas = `PBH ${recurso.nome}`
    }
    return atualizada
  })
}

function resumo(recurso: Recurso, divergencias: Divergencia[]): string {
  const linhas = [
    `### Sincronização PBH`,
    `Recurso: \`${recurso.nome}\` (atualizado em ${recurso.atualizadoEm}). 9 UPAs encontradas e validadas.`,
    '',
  ]
  if (divergencias.length === 0) {
    linhas.push('Nenhuma divergência de endereço ou coordenada.')
  } else {
    linhas.push('| UPA | campo | no projeto | na PBH |', '| --- | --- | --- | --- |')
    for (const d of divergencias) linhas.push(`| ${d.slug} | ${d.campo} | ${d.nosso} | ${d.pbh} |`)
  }
  return linhas.join('\n')
}

async function gravarFirestore(unidades: Unidade[]) {
  const { initializeApp, applicationDefault } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT
  const app = process.env.FIRESTORE_EMULATOR_HOST
    ? initializeApp({ projectId: projectId ?? 'demo-espera-zero' })
    : initializeApp({ credential: applicationDefault(), projectId })
  const db = getFirestore(app)
  const lote = db.batch()
  for (const u of unidades) lote.set(db.collection('unidades').doc(u.slug), u, { merge: true })
  await lote.commit()
}

async function main() {
  const recurso = await recursoMaisRecente()
  const pbh = lerUpas(await baixarCsv(recurso.url))
  const dados = JSON.parse(readFileSync(ARQUIVO, 'utf8')) as { metadados: Record<string, unknown>; unidades: Unidade[] }
  const divergencias = compararComBase(dados.unidades, pbh)
  const unidades = aplicar(dados.unidades, pbh, recurso, args.has('--aplicar-divergencias'))

  const texto = resumo(recurso, divergencias)
  console.log(texto)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${texto}\n`)

  if (args.has('--json')) {
    dados.unidades = unidades
    writeFileSync(ARQUIVO, `${JSON.stringify(dados, null, 2)}\n`)
    console.log(`\nunidades.json atualizado.`)
  }
  if (args.has('--firestore')) {
    await gravarFirestore(unidades)
    console.log(`\n${unidades.length} unidades gravadas no Firestore.`)
  }
}

main().catch((erro: unknown) => {
  console.error(`Falha na sincronização com a PBH: ${erro instanceof Error ? erro.message : String(erro)}`)
  process.exit(1)
})
