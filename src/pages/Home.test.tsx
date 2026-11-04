import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Home from './Home'
import geometrias from '../../packages/shared/public/bairros-geometrias.json?raw'

function renderHome(rota = '/') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Home />
    </MemoryRouter>,
  )
}

describe('Página inicial', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('deve exibir o nome Espera Zero', () => {
    renderHome()

    expect(
      screen.getByRole('heading', { name: 'Espera Zero' }),
    ).toBeInTheDocument()
  })

  it('recomenda uma UPA e avisa que a espera é simulada', async () => {
    renderHome()

    expect(await screen.findByText(/recomendada agora/i)).toBeInTheDocument()
    expect(screen.getByText(/simulados/i)).toBeInTheDocument()
  })

  it('busca o bairro ignorando acento e passa a somar o trajeto', async () => {
    renderHome()

    fireEvent.change(screen.getByLabelText(/nome do seu bairro/i), { target: { value: 'savassi' } })
    fireEvent.click(screen.getByRole('button', { name: /^Savassi/ }))

    expect(screen.getByRole('button', { name: /Você está em Savassi/ })).toBeInTheDocument()
    expect(await screen.findByText(/min de trajeto/)).toBeInTheDocument()
    expect(localStorage.getItem('ez.bairro')).not.toBeNull()
  })

  it('diz quando nenhuma UPA atende a especialidade', async () => {
    renderHome('/?esp=odonto')

    expect(await screen.findByText(/Nenhuma UPA tem odonto/i)).toBeInTheDocument()
    const abas = screen.getByRole('group', { name: 'Especialidade' })
    expect(within(abas).getByRole('button', { name: 'Odonto' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('acha o bairro pela localização do navegador sem gravar a escolha (RF-01, RN-06)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(geometrias)))
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: -19.9385, longitude: -43.9341 } } as GeolocationPosition),
      },
    })

    renderHome()

    expect(await screen.findByRole('button', { name: /Você está em Savassi/ })).toBeInTheDocument()
    expect(screen.getByText(/Pela localização do celular/)).toBeInTheDocument()
    expect(localStorage.getItem('ez.bairro')).toBeNull()
  })

  it('com a localização negada, oferece tentar de novo e a busca (RF-03)', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        getCurrentPosition: (_ok: PositionCallback, erro: PositionErrorCallback) =>
          erro({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError),
      },
    })

    renderHome()

    expect(await screen.findByText(/Sem permissão para usar a localização/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    expect(screen.getByLabelText(/nome do seu bairro/i)).toBeInTheDocument()
  })
})
