import type { ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import AvisosDeHoje from '../components/upa/avisos-de-hoje'
import BarraTopo from '../components/upa/barra-topo'
import CartaoCheckin from '../components/upa/cartao-checkin'
import { IconePino } from '../components/upa/icones'
import QuadroDaSemana from '../components/upa/quadro-da-semana'
import SituacaoPorEspecialidade from '../components/upa/situacao-por-especialidade'
import { urlRota } from '../components/upa/url-rota'
import { especialidadeInicial } from '../hooks/upa/especialidade-inicial'
import { useUpa } from '../hooks/upa/use-upa'
import { ptBR } from '../i18n/pt-BR'
import './upa.css'

const t = ptBR.upa

/** Casca comum dos estados: fundo da tela e um único <main> com um único h1. */
function Moldura({ topo, children }: { topo?: ReactNode; children: ReactNode }) {
  return (
    <div className="upa">
      {topo}
      <main className="upa-conteudo">{children}</main>
    </div>
  )
}

/** Tela 11 do Figma (UPA, antes de chegar). Rota do QR code: /u/:slug, opcional ?esp=. */
export default function Upa() {
  const { slug = '' } = useParams()
  const [parametros] = useSearchParams()
  const { estado, checkins, agoraMs, recarregar } = useUpa(slug)

  if (estado.tipo === 'carregando') {
    return (
      <Moldura>
        <h1>{t.carregando.titulo}</h1>
        <p role="status" className="upa-texto">
          {t.carregando.texto}
        </p>
      </Moldura>
    )
  }

  if (estado.tipo === 'nao-encontrada') {
    return (
      <Moldura>
        <h1>{t.naoEncontrada.titulo}</h1>
        <p className="upa-texto">{t.naoEncontrada.texto}</p>
        <Link to="/upas" className="upa-botao">
          {t.naoEncontrada.voltar}
        </Link>
      </Moldura>
    )
  }

  if (estado.tipo === 'erro') {
    return (
      <Moldura>
        <h1>{t.erro.titulo}</h1>
        <p role="alert" className="upa-texto">
          {t.erro.porCodigo[estado.codigo]}
        </p>
        {/* TODO(T15): trocar por Button de components/ui */}
        <button type="button" className="upa-botao" onClick={recarregar}>
          {t.erro.tentarDeNovo}
        </button>
      </Moldura>
    )
  }

  const { unidade, agenda, alertas, sugestoes } = estado

  return (
    <Moldura topo={<BarraTopo unidade={unidade} />}>
      <header className="upa-cabecalho">
        <h1>{unidade.nome}</h1>
        <p className="upa-endereco">
          {unidade.endereco} · {unidade.bairro}
        </p>
        {/* TODO(Integração 1): "3,9 km de Savassi · cerca de 14 min" precisa do bairro escolhido
            (ez.place, Victor) e do trajeto do shared; sem posição, a linha não aparece. */}
      </header>

      <div className="upa-acoes">
        {/* TODO(T15): trocar por Button de components/ui. O endereço fica em texto selecionável
            logo acima; "Avise minha família" (sheet 14) entra na T24. */}
        <a href={urlRota(unidade)} target="_blank" rel="noopener noreferrer" className="upa-botao">
          <IconePino />
          {t.comoChegar}
          <span className="so-leitor"> {t.novaAba}</span>
        </a>
      </div>

      <SituacaoPorEspecialidade
        unidade={unidade}
        agenda={agenda}
        alertas={alertas}
        checkins={checkins}
        agoraMs={agoraMs}
      />

      <CartaoCheckin especialidade={especialidadeInicial(unidade, parametros.get('esp'))} />

      <AvisosDeHoje alertas={alertas} agoraMs={agoraMs} />

      <QuadroDaSemana unidade={unidade} agenda={agenda} sugestoes={sugestoes} agoraMs={agoraMs} />
    </Moldura>
  )
}
