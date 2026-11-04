import { useCallback, useEffect, useRef, useState } from 'react'
import { bairroMaisProximo } from '@espera-zero/shared'
import type { BairroCentro, GeometriaBairro } from '@espera-zero/shared'
import geometriasUrl from '../../packages/shared/public/bairros-geometrias.json?url'

export type SituacaoGeo = 'parado' | 'detectando' | 'achou' | 'negado' | 'indisponivel'

let geometrias: Promise<GeometriaBairro[]> | null = null

// 400 kB of polygons: fetched only after the person shares the location.
function carregarGeometrias(): Promise<GeometriaBairro[]> {
  geometrias ??= fetch(geometriasUrl)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((dados: { bairros: GeometriaBairro[] }) => dados.bairros)
    .catch((erro) => {
      geometrias = null
      throw erro
    })
  return geometrias
}

const LIMITE_MS = 5000

/**
 * RF-01 / RN-07: asks the browser for the position and turns it into a
 * neighbourhood on this device. The position itself is never sent or stored.
 * `ativo` false means a manual choice exists, and the sensor stays off (RN-06).
 */
export function useGeolocalizacao(ativo: boolean) {
  const [situacao, setSituacao] = useState<SituacaoGeo>('parado')
  const [bairro, setBairro] = useState<BairroCentro | null>(null)
  const tentou = useRef(false)

  const detectar = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setSituacao('indisponivel')
      return
    }
    setSituacao('detectando')
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const achado = bairroMaisProximo(coords.latitude, coords.longitude, await carregarGeometrias())
          setBairro(achado?.bairro ?? null)
          setSituacao(achado ? 'achou' : 'indisponivel')
        } catch {
          setSituacao('indisponivel')
        }
      },
      (erro) => setSituacao(erro.code === erro.PERMISSION_DENIED ? 'negado' : 'indisponivel'),
      { enableHighAccuracy: false, timeout: LIMITE_MS, maximumAge: 10 * 60 * 1000 },
    )
  }, [])

  useEffect(() => {
    if (!ativo || tentou.current) return
    tentou.current = true
    detectar()
  }, [ativo, detectar])

  return { situacao, bairro, detectar }
}
