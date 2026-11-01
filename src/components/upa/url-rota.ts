import type { Unidade } from '../../services/tipos-provisorios'

/** Link de rota do Google Maps (sem chave): abre no app instalado ou no navegador. */
export function urlRota(unidade: Pick<Unidade, 'lat' | 'lng'>): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${unidade.lat},${unidade.lng}&travelmode=driving`
}
