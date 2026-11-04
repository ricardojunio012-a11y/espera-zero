import { useMemo } from 'react'
import type { Especialidade } from '@espera-zero/shared'
import { ordenarUpas, posicaoDoBairro } from '../lib/upas'
import { useBairro } from './useBairro'
import { useGeolocalizacao } from './useGeolocalizacao'
import { usePainel } from './usePainel'

/** Where the person is, plus every UPA ordered for one specialty. */
export function useRecomendacao(esp: Especialidade) {
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

  return { bairro, escolhido, escolher, geo, estado, posicao, linhas }
}
