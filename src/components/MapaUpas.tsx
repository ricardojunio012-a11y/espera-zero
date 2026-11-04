import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Posicao } from '@espera-zero/shared'
import type { LinhaUpa } from '../lib/upas'

const CENTRO_BH: L.LatLngExpression = [-19.9167, -43.9345]

const COR = { baixa: '#15803d', media: '#b45309', alta: '#b91c1c', sem: '#64748b' }

function corDa(linha: LinhaUpa): string {
  if (!linha.atende || linha.totalMin === null) return COR.sem
  if (linha.totalMin <= 40) return COR.baixa
  if (linha.totalMin <= 90) return COR.media
  return COR.alta
}

interface Props {
  linhas: LinhaUpa[]
  posicao: Posicao | null
}

/**
 * RF-12 / ADR-007: Leaflet + OpenStreetMap tiles, no key. Everything here is
 * also in the list below it, which is the path for screen readers.
 */
export default function MapaUpas({ linhas, posicao }: Props) {
  const elemento = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const camada = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!elemento.current) return
    const m = L.map(elemento.current, { scrollWheelZoom: false, attributionControl: true }).setView(CENTRO_BH, 11)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    mapa.current = m
    camada.current = L.layerGroup().addTo(m)
    return () => {
      m.remove()
      mapa.current = null
    }
  }, [])

  useEffect(() => {
    const m = mapa.current
    const grupo = camada.current
    if (!m || !grupo) return
    grupo.clearLayers()
    const pontos: L.LatLngExpression[] = []
    for (const linha of linhas) {
      const { unidade } = linha
      const texto = linha.atende && linha.totalMin !== null ? `${linha.totalMin} min no total` : linha.atende ? 'sem informação recente' : 'não atende'
      L.circleMarker([unidade.lat, unidade.lng], {
        radius: 9, color: '#fff', weight: 2, fillColor: corDa(linha), fillOpacity: 1,
      })
        .bindTooltip(`${unidade.nome} · ${texto}`)
        .addTo(grupo)
      pontos.push([unidade.lat, unidade.lng])
    }
    if (posicao) {
      L.circleMarker([posicao.lat, posicao.lng], { radius: 7, color: '#1d4ed8', weight: 3, fillColor: '#fff', fillOpacity: 1 })
        .bindTooltip('Você está aqui')
        .addTo(grupo)
      pontos.push([posicao.lat, posicao.lng])
    }
    if (pontos.length) m.fitBounds(L.latLngBounds(pontos), { padding: [24, 24] })
  }, [linhas, posicao])

  return <div ref={elemento} className="mapa" role="img" aria-label="Mapa das UPAs; a mesma informação está na lista abaixo." />
}
