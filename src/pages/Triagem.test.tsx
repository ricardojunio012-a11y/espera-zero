import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Triagem from './Triagem'

function renderTriagem() {
  return render(
    <MemoryRouter initialEntries={['/triagem']}>
      <Triagem />
    </MemoryRouter>,
  )
}

const tocar = (nome: string | RegExp) => fireEvent.click(screen.getByRole('button', { name: nome }))

function responder(...opcoes: (string | RegExp)[]) {
  for (const opcao of opcoes) tocar(opcao)
}

// Tuesday 10:00, centro de saúde open (RN-04).
const DIA_UTIL = new Date('2026-10-20T10:00:00-03:00')
// Saturday 22:00, centro de saúde closed.
const FIM_DE_SEMANA = new Date('2026-10-24T22:00:00-03:00')

describe('Triagem "Onde devo ir?"', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(DIA_UTIL)
  })
  afterEach(() => vi.useRealTimers())

  it('qualquer sinal de alerta vai direto ao 192, sem as perguntas seguintes (RF-06, RN-01)', () => {
    renderTriagem()
    responder('Para mim', 'Dor forte no peito')

    expect(screen.getByRole('heading', { name: 'Ligue 192 agora' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ligar para o SAMU/ })).toHaveAttribute('href', 'tel:192')
    expect(screen.queryByText('O que está sentindo?')).not.toBeInTheDocument()
    expect(screen.getByText(/não é diagnóstico médico/)).toBeInTheDocument()
  })

  it('queda ou torção leva à UPA com ortopedia e já recomenda uma (RN-02)', async () => {
    renderTriagem()
    responder('Para mim', 'Nenhum destes', /Queda, pancada ou torção/, 'Começou agora')

    expect(screen.getByRole('heading', { name: 'Vá a uma UPA' })).toBeInTheDocument()
    expect(screen.getByText('Ortopedia')).toBeInTheDocument()
    expect(await screen.findByText(/recomendada agora/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver todas as UPAs com ortopedia/ })).toHaveAttribute('href', '/upas?esp=ortopedia')
  })

  it('criança com febre vai para pediatria', () => {
    renderTriagem()
    responder('Para uma criança', 'Nenhum destes', 'Febre', 'Há alguns dias')

    expect(screen.getByText('Pediatria')).toBeInTheDocument()
  })

  it('receita em dia útil vai para o centro de saúde (RN-03)', () => {
    renderTriagem()
    responder('Para mim', 'Nenhum destes', /Receita, atestado/, 'Hoje')

    expect(screen.getByRole('heading', { name: 'Procure o centro de saúde' })).toBeInTheDocument()
  })

  it('com o centro de saúde fechado, muda para UPA e diz por quê (RN-04)', () => {
    vi.setSystemTime(FIM_DE_SEMANA)
    renderTriagem()
    responder('Para mim', 'Nenhum destes', /Receita, atestado/, 'Hoje')

    expect(screen.getByRole('heading', { name: 'Vá a uma UPA' })).toBeInTheDocument()
    expect(screen.getByText(/fora do horário/)).toBeInTheDocument()
  })

  it('sintoma leve e recente em adulto sugere teleconsulta', () => {
    renderTriagem()
    responder('Para mim', 'Nenhum destes', /Gripe, resfriado/, 'Hoje')

    expect(screen.getByRole('heading', { name: 'Uma teleconsulta pode resolver' })).toBeInTheDocument()
  })

  it('"Voltar" preserva a resposta anterior (RF-07)', () => {
    renderTriagem()
    responder('Para uma pessoa idosa', 'Nenhum destes')
    tocar(/Voltar/)
    tocar(/Voltar/)

    expect(screen.getByRole('button', { name: 'Para uma pessoa idosa' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('"Refazer" apaga as respostas guardadas no aparelho (RN-23)', () => {
    renderTriagem()
    responder('Para mim', 'Dor forte no peito')
    expect(sessionStorage.getItem('ez.triagem')).not.toBeNull()

    tocar('Refazer as perguntas')

    expect(screen.getByRole('heading', { name: 'Para quem é o atendimento?' })).toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem('ez.triagem') ?? '{}').respostas).toEqual({})
  })
})
