import { useCallback, useState } from 'react'
import { BAIRROS_CENTROS } from '@espera-zero/shared'
import type { BairroCentro } from '@espera-zero/shared'

const CHAVE = 'ez.bairro'

function lerSalvo(): BairroCentro | null {
  try {
    const id = localStorage.getItem(CHAVE)
    return BAIRROS_CENTROS.find((b) => b.id === id) ?? null
  } catch {
    return null
  }
}

/** RF-03: the manual choice is remembered on this device until undone. */
export function useBairro() {
  const [bairro, setBairro] = useState<BairroCentro | null>(lerSalvo)

  const escolher = useCallback((novo: BairroCentro | null) => {
    setBairro(novo)
    try {
      if (novo) localStorage.setItem(CHAVE, novo.id)
      else localStorage.removeItem(CHAVE)
    } catch {
      // Private mode: the choice just lasts this visit.
    }
  }, [])

  return { bairro, escolher }
}
