import { Link } from 'react-router-dom'
import {
  DIAS_SEG_A_DOM,
  ESPECIALIDADES_ORDEM,
  atendeNoDia,
  diaDe,
  resumoEspecialidade,
  textoOrigemDoQuadro,
} from '../../hooks/upa/quadro-semana'
import { ptBR } from '../../i18n/pt-BR'
import type { AgendaDia, SugestaoQuadro, Unidade } from '../../services/tipos-provisorios'
import { IconeCheck, IconePessoas } from './icones'

const t = ptBR.upa.quadro

interface Props {
  unidade: Unidade
  agenda: AgendaDia[]
  sugestoes: SugestaoQuadro[]
  agoraMs: number
}

/** Cartão "Quadro da semana" da tela 11: resumo. O editor fica em /u/:slug/quadro (T23). */
export default function QuadroDaSemana({ unidade, agenda, sugestoes, agoraMs }: Props) {
  const hoje = diaDe(new Date(agoraMs))
  const linhas = ESPECIALIDADES_ORDEM.map((especialidade) => ({
    especialidade,
    resumo: resumoEspecialidade(agenda, especialidade),
  }))
  const quemAtende = linhas.filter((l) => l.resumo !== null)
  const quemNao = linhas.filter((l) => l.resumo === null)

  // TODO(T23): contagem provisória (soma das confirmações das sugestões em vigor); o contrato ainda
  // não diz como contar "confirmada por N pessoas" quando a agenda inicial veio do grupo.
  const confirmacoes = sugestoes
    .filter((s) => s.status === 'vigente')
    .reduce((soma, s) => soma + s.confirmacoes, 0)

  return (
    <section aria-labelledby="quadro-titulo" className="upa-cartao">
      <div className="upa-cartao-topo">
        <h2 id="quadro-titulo">{t.titulo}</h2>
        <Link to={`/u/${unidade.slug}/quadro`} className="upa-link">
          {t.sugerir}
        </Link>
      </div>

      <table className="upa-quadro">
        <caption className="so-leitor">{t.legendaTabela}</caption>
        <thead>
          <tr>
            <td />
            {DIAS_SEG_A_DOM.map((dia) => (
              <th
                key={dia}
                scope="col"
                className={dia === hoje ? 'upa-hoje' : undefined}
                aria-current={dia === hoje ? 'date' : undefined}
              >
                {ptBR.dia[dia]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {quemAtende.map(({ especialidade }) => (
            <tr key={especialidade}>
              <th scope="row">{ptBR.especialidadeCurta[especialidade]}</th>
              {DIAS_SEG_A_DOM.map((dia) => (
                <td key={dia} className={dia === hoje ? 'upa-hoje' : undefined}>
                  {atendeNoDia(agenda, dia, especialidade) ? (
                    <>
                      <span className="upa-marca" aria-hidden="true">
                        <IconeCheck />
                      </span>
                      <span className="so-leitor">{t.atende}</span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true" className="upa-mudo">
                        –
                      </span>
                      <span className="so-leitor">{t.naoAtendeCelula}</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="upa-legenda">
        {quemAtende.map(({ especialidade, resumo }) => (
          <li key={especialidade}>
            <strong>{ptBR.especialidade[especialidade]}:</strong> {resumo}
          </li>
        ))}
        {quemNao.length > 0 && (
          <li>
            <strong>{t.naoAtende}:</strong>{' '}
            {quemNao.map((l) => ptBR.especialidade[l.especialidade].toLowerCase()).join(', ')}
          </li>
        )}
      </ul>

      <p className="upa-origem">
        <IconePessoas />
        <span>{textoOrigemDoQuadro(confirmacoes)}</span>
      </p>
    </section>
  )
}
