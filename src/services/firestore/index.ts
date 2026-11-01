// TODO(T25): implementação real com o SDK Web (dono: Caio). Deve passar em
// testarContrato() (src/services/contrato/testes-de-contrato.ts) contra o emulador.
import { ServicoErro, type Servicos } from '../contrato-servicos'

function naoImplementado(): never {
  throw new ServicoErro('desconhecido', 'não implementado')
}

// Async para que o erro chegue como rejeição, como nas implementações reais.
const rejeitar = async (): Promise<never> => naoImplementado()

export function criarServicosFirestore(): Servicos {
  return {
    getUnidades: rejeitar,
    getUnidade: rejeitar,
    getAgenda: rejeitar,
    observarCheckins: naoImplementado,
    registrarCheckin: rejeitar,
    listarAlertas: rejeitar,
    criarAlerta: rejeitar,
    votarAlerta: rejeitar,
    listarSugestoes: rejeitar,
    criarSugestao: rejeitar,
    confirmarSugestao: rejeitar,
    getHistorico: rejeitar,
    getGeometriasBairros: rejeitar,
    garantirSessao: rejeitar,
  }
}
