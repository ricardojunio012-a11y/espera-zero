import { Suspense, lazy, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Especialidade } from '@espera-zero/shared'
import { useBairro } from '../hooks/useBairro'
import { useGeolocalizacao } from '../hooks/useGeolocalizacao'
import { usePainel } from '../hooks/usePainel'
import { ESPECIALIDADES, nomeEspecialidade, ordenarUpas, porQue, posicaoDoBairro } from '../lib/upas'
import AbasEspecialidade from './AbasEspecialidade'
import CartaoUpa from './CartaoUpa'
import SeletorBairro from './SeletorBairro'

// Leaflet only loads on the list page; if it fails, the list still works (RF-12).
const MapaUpas = lazy(() => import('./MapaUpas'))

function lerEspecialidade(valor: string | null): Especialidade {
  return ESPECIALIDADES.find((e) => e.id === valor)?.id ?? 'clinica'
}

interface Props {
  /** Home shows only the recommendation; /upas shows every UPA. */
  modo: 'recomendacao' | 'lista'
}

export default function QualUpa({ modo }: Props) {
  const [params, setParams] = useSearchParams()
  const esp = lerEspecialidade(params.get('esp'))
  const { bairro: escolhido, escolher } = useBairro()
  const geo = useGeolocalizacao(escolhido === null)
  // RN-06: a manual choice always beats the sensor.
  const bairro = escolhido ?? geo.bairro
  const estado = usePainel()
  const posicao = useMemo(() => (bairro ? posicaoDoBairro(bairro) : null), [bairro])

  const linhas = useMemo(
    () => (estado.situacao === 'pronto' ? ordenarUpas(estado.painel, esp, posicao, estado.agora) : []),
    [estado, esp, posicao],
  )

  function mudarEspecialidade(nova: Especialidade) {
    setParams(nova === 'clinica' ? {} : { esp: nova }, { replace: true })
  }

  const recomendada = linhas[0]?.atende ? linhas[0] : null
  const motivo = porQue(linhas, posicao)
  const titulo = modo === 'lista' ? 'Todas as UPAs' : 'Qual UPA eu vou agora?'
  const busca = params.size ? `?${params}` : ''

  return (
    <>
      <SeletorBairro
        bairro={bairro}
        automatico={escolhido === null && bairro !== null}
        geo={geo.situacao}
        onEscolher={escolher}
        onDetectar={geo.detectar}
      />

      <section className="bloco" aria-labelledby="titulo-qual-upa">
        <div className="bloco-cabeca">
          <h2 id="titulo-qual-upa">{titulo}</h2>
          {modo === 'recomendacao'
            ? <Link to={`/upas${busca}`} className="link-secundario">ver todas</Link>
            : <Link to={`/${busca}`} className="link-secundario">voltar</Link>}
        </div>
        <AbasEspecialidade valor={esp} onMudar={mudarEspecialidade} />

        {estado.situacao === 'carregando' && <p className="ajuda" role="status">Carregando as UPAs…</p>}
        {estado.situacao === 'erro' && (
          <p className="erro" role="alert">Não foi possível carregar as UPAs agora. Tente de novo em instantes.</p>
        )}

        {estado.situacao === 'pronto' && (
          <>
            {estado.painel.simulado && (
              <p className="aviso-simulado">
                Protótipo: os tempos de espera são <strong>simulados</strong>. As UPAs, os endereços e os
                bairros são os dados reais da Prefeitura.
              </p>
            )}

            {!bairro && (
              <p className="ajuda">Escolha o seu bairro para somar o tempo de trajeto à espera.</p>
            )}

            {modo === 'recomendacao' && (
              recomendada ? (
                <>
                  <CartaoUpa linha={recomendada} especialidade={esp} destaque />
                  {motivo && <p className="motivo">{motivo}</p>}
                </>
              ) : (
                <p className="vazio">
                  Nenhuma UPA tem {nomeEspecialidade(esp).toLowerCase()} no quadro de hoje.
                  Em caso de urgência, procure a UPA mais perto ou ligue 192.
                </p>
              )
            )}

            {modo === 'lista' && (
              <>
                <Suspense fallback={<div className="mapa mapa-carregando" aria-hidden="true" />}>
                  <MapaUpas linhas={linhas} posicao={posicao} />
                </Suspense>
                <ol className="lista-upas">
                  {linhas.map((linha, i) => (
                    <li key={linha.unidade.slug}>
                      <CartaoUpa linha={linha} especialidade={esp} destaque={i === 0 && linha.atende} />
                    </li>
                  ))}
                </ol>
              </>
            )}
          </>
        )}
      </section>
    </>
  )
}
