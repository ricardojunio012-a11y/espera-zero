import { useEffect, useRef, useState } from 'react'
import { SINAIS_ALERTA, centroSaudeEstaAberto, triagem } from '@espera-zero/shared'
import type { RespostasTriagem, ResultadoTriagem } from '@espera-zero/shared'
import Layout from '../components/Layout'
import ResultadoTriagemView from '../components/ResultadoTriagem'
import {
  PARA_QUEM, PASSOS, SINTOMAS, TEMPOS, apagarRascunho, completas, lerRascunho, salvarRascunho,
} from '../lib/triagem'
import type { Passo, Rascunho } from '../lib/triagem'

const TITULO: Record<Passo, string> = {
  'para-quem': 'Para quem é o atendimento?',
  alerta: 'Está acontecendo algum destes agora?',
  sintoma: 'O que está sentindo?',
  tempo: 'Desde quando?',
}

function Opcao({ texto, detalhe, marcada, onEscolher, perigo = false }: {
  texto: string
  detalhe?: string
  marcada?: boolean
  onEscolher: () => void
  perigo?: boolean
}) {
  return (
    <li>
      <button
        type="button"
        className={perigo ? 'opcao opcao-perigo' : 'opcao'}
        aria-pressed={marcada}
        onClick={onEscolher}
      >
        <span>{texto}</span>
        {detalhe && <span className="opcao-detalhe">{detalhe}</span>}
      </button>
    </li>
  )
}

/** RF-05 to RF-07: four steps, four destinations, no timer, answers kept on "Voltar". */
export default function Triagem() {
  const [rascunho, setRascunho] = useState<Rascunho>(lerRascunho)
  const titulo = useRef<HTMLHeadingElement>(null)
  const { passo, respostas } = rascunho

  useEffect(() => {
    salvarRascunho(rascunho)
  }, [rascunho])

  // Each step is a new screen for a screen reader: move focus to its question.
  useEffect(() => {
    titulo.current?.focus()
  }, [passo])

  function responder(parcial: Partial<RespostasTriagem>, proximo: Rascunho['passo']) {
    setRascunho({ passo: proximo, respostas: { ...respostas, ...parcial } })
  }

  function voltar() {
    const i = passo === 'resultado' ? PASSOS.length : PASSOS.indexOf(passo)
    // From an emergency result, "Voltar" goes back to the alert question.
    const destino = passo === 'resultado' && (respostas.sinaisAlerta?.length ?? 0) > 0 ? 'alerta' : PASSOS[i - 1]
    if (destino) setRascunho({ passo: destino, respostas })
  }

  function refazer() {
    apagarRascunho()
    setRascunho({ passo: 'para-quem', respostas: {} })
  }

  let resultado: ResultadoTriagem | null = null
  if (passo === 'resultado') {
    // RN-01: an alert sign ends the triage, whatever else was answered.
    const alerta = (respostas.sinaisAlerta?.length ?? 0) > 0
    resultado = alerta
      ? triagem({ paraQuem: respostas.paraQuem ?? 'eu', sinaisAlerta: respostas.sinaisAlerta ?? [], sintoma: '', tempo: 'agora' })
      : completas(respostas) ? triagem(respostas, { centroSaudeAberto: centroSaudeEstaAberto(new Date()) }) : null
  }

  const numero = passo === 'resultado' ? null : PASSOS.indexOf(passo) + 1

  return (
    <Layout>
      <nav className="triagem-topo" aria-label="Triagem">
        {passo !== 'para-quem' && (
          <button type="button" className="botao-texto" onClick={voltar}>‹ Voltar</button>
        )}
        {numero && <p className="ajuda">Passo {numero} de {PASSOS.length}</p>}
      </nav>

      {passo !== 'resultado' && (
        <section className="bloco" aria-labelledby="pergunta">
          <h2 id="pergunta" ref={titulo} tabIndex={-1} className="pergunta">{TITULO[passo]}</h2>

          {passo === 'para-quem' && (
            <ul className="opcoes">
              {PARA_QUEM.map((o) => (
                <Opcao key={o.id} texto={o.texto} marcada={respostas.paraQuem === o.id}
                  onEscolher={() => responder({ paraQuem: o.id }, 'alerta')} />
              ))}
            </ul>
          )}

          {passo === 'alerta' && (
            <>
              <p className="ajuda">Se sim, toque nele. É melhor ligar sem precisar do que esperar numa emergência.</p>
              <ul className="opcoes">
                {SINAIS_ALERTA.map((s) => (
                  <Opcao key={s.id} texto={s.texto} perigo
                    onEscolher={() => responder({ sinaisAlerta: [s.id] }, 'resultado')} />
                ))}
                <Opcao texto="Nenhum destes" marcada={respostas.sinaisAlerta?.length === 0}
                  onEscolher={() => responder({ sinaisAlerta: [] }, 'sintoma')} />
              </ul>
            </>
          )}

          {passo === 'sintoma' && (
            <ul className="opcoes">
              {SINTOMAS.map((s) => (
                <Opcao key={s.valor} texto={s.texto} detalhe={s.detalhe} marcada={respostas.sintoma === s.valor}
                  onEscolher={() => responder({ sintoma: s.valor }, 'tempo')} />
              ))}
            </ul>
          )}

          {passo === 'tempo' && (
            <ul className="opcoes">
              {TEMPOS.map((t) => (
                <Opcao key={t.id} texto={t.texto} marcada={respostas.tempo === t.id}
                  onEscolher={() => responder({ tempo: t.id }, 'resultado')} />
              ))}
            </ul>
          )}
        </section>
      )}

      {passo === 'resultado' && (
        resultado
          ? <ResultadoTriagemView resultado={resultado} tituloRef={titulo} onRefazer={refazer} />
          : (
            <section className="bloco">
              <h2 ref={titulo} tabIndex={-1}>Faltou uma resposta</h2>
              <button type="button" className="botao" onClick={refazer}>Refazer as perguntas</button>
            </section>
          )
      )}
    </Layout>
  )
}
