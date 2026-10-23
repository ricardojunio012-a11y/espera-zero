import { useId, useMemo, useState } from 'react'
import { BAIRROS_CENTROS, normalizar } from '@espera-zero/shared'
import type { BairroCentro, Regional } from '@espera-zero/shared'

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

interface Props {
  bairro: BairroCentro | null
  onEscolher: (bairro: BairroCentro | null) => void
}

/** RF-02: the 493 official neighbourhoods, searchable, ignoring accents and case. */
export default function SeletorBairro({ bairro, onEscolher }: Props) {
  const [aberto, setAberto] = useState(bairro === null)
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
    setAberto(false)
  }

  if (!aberto && bairro) {
    return (
      <div className="seletor-bairro">
        <button type="button" className="pilula" onClick={() => setAberto(true)}>
          <span aria-hidden="true">⌖</span> Você está em <strong>{bairro.nome}</strong>
          <span className="sr-only">. Trocar o bairro</span>
        </button>
      </div>
    )
  }

  return (
    <section className="seletor-bairro painel" aria-labelledby={idBusca + '-titulo'}>
      <h2 id={idBusca + '-titulo'} className="painel-titulo">Onde você está?</h2>
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
        <button type="button" className="botao-texto" onClick={() => setAberto(false)}>
          Manter {bairro.nome}
        </button>
      )}
    </section>
  )
}
