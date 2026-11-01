import { ptBR } from '../../i18n/pt-BR'
import type { Especialidade } from '../../services/tipos-provisorios'
import { IconeCheck } from './icones'

const t = ptBR.upa.checkin

/** Cartão "Check-in" da tela 11 (estado antes de chegar). */
export default function CartaoCheckin({ especialidade }: { especialidade: Especialidade | null }) {
  return (
    <section aria-labelledby="checkin-titulo" className="upa-cartao">
      <h2 id="checkin-titulo">{t.titulo}</h2>
      <p className="upa-texto">{t.texto}</p>
      {/* TODO(T22 parte 2): abrir o sheet de check-in (tela 13) com `especialidade` pré-selecionada
          (vem de ?esp=) e gravar ez.checkin. Por enquanto só o botão. */}
      <button type="button" className="upa-botao-principal" data-especialidade={especialidade ?? undefined}>
        <IconeCheck />
        {t.botao}
      </button>
    </section>
  )
}
