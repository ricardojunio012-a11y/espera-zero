import type { LinhaUpa } from '../lib/upas'
import { linkComoChegar, origemDaEstimativa, precisaConfirmar } from '../lib/upas'

interface Props {
  linha: LinhaUpa
  destaque?: boolean
}

function nivelEspera(minutos: number): 'baixa' | 'media' | 'alta' {
  if (minutos <= 40) return 'baixa'
  if (minutos <= 90) return 'media'
  return 'alta'
}

const TEXTO_NIVEL = { baixa: 'espera curta', media: 'espera média', alta: 'espera longa' }

export default function CartaoUpa({ linha, destaque = false }: Props) {
  const { unidade } = linha

  if (!linha.atende) {
    return (
      <article className="cartao cartao-inativo">
        <div className="cartao-cabeca">
          <h3 className="cartao-nome">{unidade.nome}</h3>
          <span className="selo selo-neutro">não atende</span>
        </div>
        <p className="cartao-detalhe">{unidade.bairro} · sem esta especialidade no quadro de hoje</p>
      </article>
    )
  }

  const { estimativa, trajetoMin, totalMin } = linha
  const nivel = totalMin === null ? null : nivelEspera(totalMin)

  return (
    <article className={destaque ? 'cartao cartao-destaque' : 'cartao'}>
      {destaque && <p className="cartao-rotulo"><span aria-hidden="true">✓ </span>Recomendada agora</p>}
      <div className="cartao-cabeca">
        <h3 className="cartao-nome">{unidade.nome}</h3>
        {totalMin !== null && nivel && (
          <p className={`total total-${nivel}`}>
            <span className="total-numero">{totalMin}</span>
            <span className="total-unidade">min<span className="sr-only"> no total, {TEXTO_NIVEL[nivel]}</span></span>
          </p>
        )}
      </div>
      <p className="cartao-detalhe">
        {estimativa.minutos === null ? 'Espera sem informação recente' : `${estimativa.minutos} min de espera`}
        {trajetoMin !== null && ` · ${trajetoMin} min de trajeto`}
        {' · '}{unidade.bairro}
      </p>
      <p className="cartao-origem">
        {origemDaEstimativa(estimativa)}
        {estimativa.minutos !== null && precisaConfirmar(estimativa) && ' · confirme ao chegar'}
      </p>
      <a className="link-rota" href={linkComoChegar(unidade)} target="_blank" rel="noreferrer">
        Como chegar<span className="sr-only"> à {unidade.nome} (abre o Google Maps)</span>
      </a>
    </article>
  )
}
