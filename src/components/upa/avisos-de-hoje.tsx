import { minutosParaExpirar, tituloDoAviso, tomDoAviso } from '../../hooks/upa/aviso-apresentacao'
import { ptBR } from '../../i18n/pt-BR'
import { alertaAtivo } from '../../services/regras-provisorias'
import type { Alerta } from '../../services/tipos-provisorios'
import { IconeAlerta, IconeCheck, IconeInfo } from './icones'

const t = ptBR.upa.avisos
const ICONE = { positivo: IconeCheck, problema: IconeAlerta, info: IconeInfo }

interface Props {
  alertas: Alerta[]
  agoraMs: number
}

/**
 * Cartão "Avisos de hoje" da tela 11, somente leitura.
 * TODO(T24): "+ Avisar algo" (sheet, tela 15) e os botões "Confirmo" / "Não é mais assim".
 */
export default function AvisosDeHoje({ alertas, agoraMs }: Props) {
  const ativos = alertas
    .filter((a) => alertaAtivo(a, agoraMs))
    .sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm))

  return (
    <section aria-labelledby="avisos-titulo" className="upa-cartao">
      <div className="upa-cartao-topo">
        <h2 id="avisos-titulo">{t.titulo}</h2>
      </div>
      {ativos.length === 0 ? (
        <p className="upa-texto">{t.vazio}</p>
      ) : (
        <>
          <ul className="upa-avisos">
            {ativos.map((a) => {
              const tom = tomDoAviso(a)
              const Icone = ICONE[tom]
              const idadeMin = Math.max(0, Math.floor((agoraMs - Date.parse(a.criadoEm)) / 60_000))
              return (
                // O mock devolve `id` em tempo de execução (ver TODO(contrato) em mock/index.ts).
                <li key={(a as Alerta & { id?: string }).id ?? a.criadoEm + a.tipo} className="upa-aviso">
                  <span className={`upa-aviso-icone upa-aviso-icone--${tom}`}>
                    <Icone />
                  </span>
                  <div>
                    <p className="upa-aviso-titulo">{tituloDoAviso(a)}</p>
                    <p className="upa-aviso-meta">
                      {ptBR.haMinutos(idadeMin)} · {ptBR.pessoas(a.confirmacoes)} ·{' '}
                      {ptBR.expiraEm(minutosParaExpirar(a, agoraMs))}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="upa-nota">{t.rodape}</p>
        </>
      )}
    </section>
  )
}
