import { useId, useMemo, useState } from 'react'
import { BAIRROS_CENTROS, normalizar } from '@espera-zero/shared'
import type { BairroCentro, Regional } from '@espera-zero/shared'
import type { SituacaoGeo } from '../hooks/useGeolocalizacao'

const NOME_REGIONAL: Record<Regional, string> = {
  barreiro: 'Barreiro',
  'centro-sul': 'Centro-Sul',
  leste: 'Leste',
  nordeste: 'Nordeste',
  noroeste: 'Noroeste',
  norte: 'Norte',
  oeste: 'Oeste',
  pampulha: 'Pampulha',
  'venda-nova': 'Venda Nova',
}

const MAXIMO_VISIVEL = 40

const BAIRROS_ORDENADOS = [...BAIRROS_CENTROS]
  .map((bairro) => ({ bairro, busca: normalizar(bairro.nome) }))
  .sort((a, b) => a.bairro.nome.localeCompare(b.bairro.nome, 'pt-BR'))

const TEXTO_GEO: Partial<Record<SituacaoGeo, string>> = {
  detectando: 'Detectando sua localização… Se preferir, escolha o bairro abaixo.',
  negado: 'Sem permissão para usar a localização. Escolha o seu bairro abaixo.',
  indisponivel: 'Não foi possível achar a sua localização agora. Escolha o seu bairro abaixo.',
}

interface Props {
  bairro: BairroCentro | null
  /** True when the neighbourhood came from the browser's location, not a choice. */
  automatico: boolean
  geo: SituacaoGeo
  onEscolher: (bairro: BairroCentro | null) => void
  onDetectar: () => void
}

/** RF-02: the 493 official neighbourhoods, searchable, ignoring accents and case. */
export default function SeletorBairro({ bairro, automatico, geo, onEscolher, onDetectar }: Props) {
  const [editando, setEditando] = useState(false)
  const [termo, setTermo] = useState('')
  const idBusca = useId()
  const idContagem = useId()

  const resultados = useMemo(() => {
    const t = normalizar(termo)
    return t ? BAIRROS_ORDENADOS.filter((b) => b.busca.includes(t)).map((b) => b.bairro) : []
  }, [termo])

  function escolher(novo: BairroCentro) {
    onEscolher(novo)
    setTermo('')
    setEditando(false)
  }

  if (bairro && !editando) {
    return (
      <div className="seletor-bairro">
        <button type="button" className="pilula" onClick={() => setEditando(true)}>
          <span aria-hidden="true">⌖</span> Você está em <strong>{bairro.nome}</strong>
          <span className="sr-only">. Trocar o bairro</span>
        </button>
        {automatico && <p className="ajuda">Pela localização do celular. Não está certo? Toque para trocar.</p>}
      </div>
    )
  }

  const textoGeo = TEXTO_GEO[geo]

  return (
    <section className="seletor-bairro painel" aria-labelledby={idBusca + '-titulo'}>
      <h2 id={idBusca + '-titulo'} className="painel-titulo">Onde você está?</h2>
      {textoGeo && <p className="ajuda" role="status">{textoGeo}</p>}
      {(geo === 'negado' || geo === 'indisponivel' || geo === 'parado') && (
        <button type="button" className="botao-texto" onClick={onDetectar}>
          {geo === 'parado' ? 'Usar minha localização' : 'Tentar de novo'}
        </button>
      )}
      <label htmlFor={idBusca} className="rotulo">Digite o nome do seu bairro</label>
      <input
        id={idBusca}
        className="campo"
        type="search"
        autoComplete="off"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        aria-describedby={idContagem}
        placeholder="Ex.: Savassi, Barreiro, Pampulha"
      />
      <p id={idContagem} className="ajuda" aria-live="polite">
        {termo.trim() === ''
          ? `${BAIRROS_CENTROS.length} bairros oficiais de Belo Horizonte.`
          : `${resultados.length} ${resultados.length === 1 ? 'bairro encontrado' : 'bairros encontrados'}.`}
      </p>
      {resultados.length > 0 && (
        <ul className="lista-bairros">
          {resultados.slice(0, MAXIMO_VISIVEL).map((b) => (
            <li key={b.id}>
              <button type="button" className="opcao-bairro" onClick={() => escolher(b)}>
                <span>{b.nome}</span>
                <span className="regional">{NOME_REGIONAL[b.regional]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {resultados.length > MAXIMO_VISIVEL && (
        <p className="ajuda">Mostrando {MAXIMO_VISIVEL}. Digite mais letras para achar o seu.</p>
      )}
      {bairro && (
        <button type="button" className="botao-texto" onClick={() => setEditando(false)}>
          Manter {bairro.nome}
        </button>
      )}
    </section>
  )
}
