import { faixaDeEspera, preenchimentoDaBarra } from '../../hooks/upa/faixa-espera'
import {
  ESPECIALIDADES_ORDEM,
  abreQuando,
  textoHorario,
} from '../../hooks/upa/quadro-semana'
import {
  horarioDeHoje,
  situacaoEspecialidade,
  type Situacao,
} from '../../hooks/upa/situacao-especialidade'
import { ptBR } from '../../i18n/pt-BR'
import { estimarEspera } from '../../services/regras-provisorias'
import type { AgendaDia, Alerta, Checkin, Unidade } from '../../services/tipos-provisorios'
import { IconePessoas } from './icones'

const t = ptBR.upa.agora

interface Props {
  unidade: Unidade
  agenda: AgendaDia[]
  alertas: Alerta[]
  checkins: Checkin[]
  agoraMs: number
}

/** Cartão "Agora" da tela 11: espera por especialidade, com barra, faixa de cor e horário. */
export default function SituacaoPorEspecialidade({ unidade, agenda, alertas, checkins, agoraMs }: Props) {
  const agora = new Date(agoraMs)
  const linhas = ESPECIALIDADES_ORDEM.map((especialidade) => ({
    especialidade,
    situacao: situacaoEspecialidade({ unidade, agenda, alertas, especialidade, agora }),
    estimativa: estimarEspera(checkins, agoraMs, especialidade),
  }))

  // Selo do cartão (RN-24): total de relatos e a idade do mais recente.
  const totalRelatos = linhas.reduce((soma, l) => soma + l.estimativa.relatos, 0)
  const idades = linhas.flatMap((l) => (l.estimativa.ultimoHaMin === null ? [] : [l.estimativa.ultimoHaMin]))
  const seloComDados = totalRelatos > 0 && idades.length > 0

  // Anunciado em aria-live="polite": só muda quando a situação ou os minutos mudam. Não inclui
  // "há X min", senão o leitor de tela falaria isso a cada minuto.
  const resumo = linhas
    .filter((l) => l.situacao !== 'nao-atende')
    .map(({ especialidade, situacao, estimativa }) => {
      const espera = situacao === 'atende' && estimativa.minutos !== null ? `, ${estimativa.minutos} min` : ''
      return `${ptBR.especialidade[especialidade]}: ${ptBR.upa.situacaoAnunciada[situacao]}${espera}.`
    })
    .join(' ')

  return (
    <section aria-labelledby="agora-titulo" className="upa-cartao">
      <div className="upa-cartao-topo">
        <h2 id="agora-titulo">{t.titulo}</h2>
        <span className={`upa-selo ${seloComDados ? 'upa-selo--ok' : 'upa-selo--mudo'}`}>
          {seloComDados ? (
            <>
              <IconePessoas />
              {ptBR.relatos(totalRelatos)} · {ptBR.haMinutos(Math.min(...idades))}
            </>
          ) : (
            t.semInformacao
          )}
        </span>
      </div>

      <ul className="upa-linhas">
        {linhas.map(({ especialidade, situacao, estimativa }) => (
          <li key={especialidade} className={`upa-linha upa-linha--${situacao}`}>
            <span className="upa-linha-nome">{ptBR.especialidade[especialidade]}</span>
            <Valor
              situacao={situacao}
              minutos={estimativa.minutos}
              relatos={estimativa.relatos}
              haMin={estimativa.ultimoHaMin}
              abre={abreQuando(agenda, especialidade, agora)}
            />
            {situacao === 'atende' && estimativa.minutos !== null && (
              <div className="upa-trilho" aria-hidden="true">
                <div
                  className={`upa-trilho-preenchimento upa-faixa--${faixaDeEspera(estimativa.minutos)}`}
                  style={{ width: `${Math.round(preenchimentoDaBarra(estimativa.minutos) * 100)}%` }}
                />
              </div>
            )}
            {situacao !== 'nao-atende' && (
              <span className="upa-linha-sub">
                {situacao === 'fechado'
                  ? t.quadroDaSemana
                  : (textoHorario(horarioDeHoje(agenda, especialidade, agora)) ?? t.avisoDaComunidade)}
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="upa-nota">{t.rodape}</p>
      <p role="status" aria-live="polite" aria-atomic="true" className="so-leitor">
        {resumo}
      </p>
    </section>
  )
}

function Valor(props: {
  situacao: Situacao
  minutos: number | null
  relatos: number
  haMin: number | null
  abre: string | null
}) {
  const { situacao, minutos, relatos, haMin, abre } = props
  if (situacao === 'nao-atende') return <span className="upa-linha-valor upa-mudo">{t.naoAtende}</span>
  if (situacao === 'fechado') return <span className="upa-linha-valor upa-mudo">{abre ?? t.fechado}</span>
  if (minutos === null || haMin === null) {
    return <span className="upa-linha-valor upa-mudo">{t.semInformacao}</span>
  }
  // O leitor de tela ouve o número com a origem; o visual é só o número grande.
  return (
    <span className={`upa-linha-valor upa-min upa-faixa--${faixaDeEspera(minutos)}`}>
      <span className="so-leitor">{ptBR.esperaAcessivel(minutos, relatos, haMin)}</span>
      <span aria-hidden="true" className="upa-min-numero">
        {minutos}
      </span>
      <span aria-hidden="true" className="upa-min-unidade">
        {t.min}
      </span>
    </span>
  )
}
