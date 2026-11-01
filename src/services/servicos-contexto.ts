import { createContext } from 'react'
import type { Servicos } from './contrato-servicos'

/** `null` = nenhum provider acima; useServicos() cai na instância padrão. */
export const ServicosContexto = createContext<Servicos | null>(null)
