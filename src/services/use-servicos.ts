import { useContext } from 'react'
import type { Servicos } from './contrato-servicos'
import { criarServicosPadrao } from './escolher'
import { ServicosContexto } from './servicos-contexto'

let padrao: Servicos | null = null

/** Instância usada quando não há <ServicosProvider>; criada na primeira chamada. */
function servicosPadrao(): Servicos {
  padrao ??= criarServicosPadrao()
  return padrao
}

export function useServicos(): Servicos {
  return useContext(ServicosContexto) ?? servicosPadrao()
}
