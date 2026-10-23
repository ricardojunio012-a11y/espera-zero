import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import Home from './Home'

function renderHome(rota = '/') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Home />
    </MemoryRouter>,
  )
}

describe('Página inicial', () => {
  beforeEach(() => localStorage.clear())

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
})
