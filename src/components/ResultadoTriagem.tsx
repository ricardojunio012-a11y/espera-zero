import type { RefObject } from 'react'
import { Link } from 'react-router-dom'
import type { Especialidade, ResultadoTriagem as Resultado } from '@espera-zero/shared'
import { useRecomendacao } from '../hooks/useRecomendacao'
import { nomeEspecialidade, porQue } from '../lib/upas'
import CartaoUpa from './CartaoUpa'
import SeletorBairro from './SeletorBairro'

const CABECALHO: Record<Resultado['destino'], { rotulo: string; titulo: string; classe: string }> = {
  samu: { rotulo: 'Emergência', titulo: 'Ligue 192 agora', classe: 'resultado-samu' },
  upa: { rotulo: 'Urgência', titulo: 'Vá a uma UPA', classe: 'resultado-upa' },
  'centro-saude': { rotulo: 'Sem urgência', titulo: 'Procure o centro de saúde', classe: 'resultado-calmo' },
  teleconsulta: { rotulo: 'Sem urgência', titulo: 'Uma teleconsulta pode resolver', classe: 'resultado-calmo' },
}

function RecomendacaoPara({ esp }: { esp: Especialidade }) {
  const { bairro, escolhido, escolher, geo, estado, posicao, linhas } = useRecomendacao(esp)
  const recomendada = linhas[0]?.atende ? linhas[0] : null
  const motivo = porQue(linhas, posicao)

  return (
    <section className="bloco" aria-labelledby="titulo-upa-triagem">
      <h3 id="titulo-upa-triagem" className="subtitulo">Qual UPA eu vou agora?</h3>
      <SeletorBairro
        bairro={bairro}
        automatico={escolhido === null && bairro !== null}
        geo={geo.situacao}
        onEscolher={escolher}
        onDetectar={geo.detectar}
      />
      {estado.situacao === 'carregando' && <p className="ajuda" role="status">Carregando as UPAs…</p>}
      {estado.situacao === 'erro' && <p className="erro" role="alert">Não foi possível carregar as UPAs agora.</p>}
      {estado.situacao === 'pronto' && (
        <>
          {estado.painel.simulado && (
            <p className="aviso-simulado">Protótipo: os tempos de espera são <strong>simulados</strong>.</p>
          )}
          {recomendada
            ? <CartaoUpa linha={recomendada} especialidade={esp} destaque />
            : <p className="vazio">Nenhuma UPA tem {nomeEspecialidade(esp).toLowerCase()} no quadro de hoje. Procure a UPA mais perto.</p>}
          {motivo && <p className="motivo">{motivo}</p>}
          <Link to={`/upas?esp=${esp}`} className="botao botao-secundario">
            Ver todas as UPAs com {nomeEspecialidade(esp).toLowerCase()}
          </Link>
        </>
      )}
    </section>
  )
}

interface Props {
  resultado: Resultado
  tituloRef: RefObject<HTMLHeadingElement | null>
  onRefazer: () => void
}

export default function ResultadoTriagem({ resultado, tituloRef, onRefazer }: Props) {
  const { destino, especialidade, motivos } = resultado
  const cabecalho = CABECALHO[destino]

  return (
    <>
      <section className={`resultado ${cabecalho.classe}`} aria-labelledby="titulo-resultado">
        <p className="resultado-rotulo">{cabecalho.rotulo}</p>
        <h2 id="titulo-resultado" ref={tituloRef} tabIndex={-1} className="resultado-titulo">{cabecalho.titulo}</h2>
        {destino === 'upa' && especialidade && (
          <p>Especialidade: <strong>{nomeEspecialidade(especialidade)}</strong></p>
        )}
        {destino === 'samu' && (
          <>
            <p className="numero-192">192</p>
            <a className="botao botao-perigo" href="tel:192">Ligar para o SAMU (192)</a>
          </>
        )}
      </section>

      <ul className="motivos">
        {motivos.map((m) => <li key={m}>{m}</li>)}
      </ul>

      {destino === 'upa' && especialidade && <RecomendacaoPara esp={especialidade} />}
      {destino === 'upa' && !especialidade && (
        <Link to="/upas" className="botao botao-secundario">Ver as UPAs</Link>
      )}
      {(destino === 'centro-saude' || destino === 'teleconsulta') && (
        <p className="ajuda">
          Se piorar ou aparecer algum sinal de alerta, procure uma UPA (<Link to="/upas">ver as UPAs</Link>) ou ligue 192.
        </p>
      )}

      {/* RN-05: fixed on every result screen. */}
      <p className="aviso-fixo">
        Esta orientação não é diagnóstico médico e não substitui a avaliação de um profissional.
        Em dúvida ou se piorar, ligue <strong>192</strong>.
      </p>
      <button type="button" className="botao-texto" onClick={onRefazer}>Refazer as perguntas</button>
    </>
  )
}
