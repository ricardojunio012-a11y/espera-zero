import { useEffect, useState } from 'react'
import { obterServicos } from '../services/servicos'
import type { Painel } from '../services/servicos'

type Estado =
  | { situacao: 'carregando' }
  | { situacao: 'erro' }
  | { situacao: 'pronto'; painel: Painel; agora: Date }

export function usePainel(): Estado {
  const [estado, setEstado] = useState<Estado>({ situacao: 'carregando' })

  useEffect(() => {
    let ativo = true
    const agora = new Date()
    obterServicos().carregarPainel(agora)
      .then((painel) => { if (ativo) setEstado({ situacao: 'pronto', painel, agora }) })
      .catch(() => { if (ativo) setEstado({ situacao: 'erro' }) })
    return () => { ativo = false }
  }, [])

  return estado
}
