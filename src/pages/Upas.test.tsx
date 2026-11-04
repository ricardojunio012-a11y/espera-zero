import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Upas from './Upas'

// Leaflet needs a real layout engine; the list is what carries the content.
vi.mock('../components/MapaUpas', () => ({ default: () => <div data-testid="mapa" /> }))

describe('Todas as UPAs', () => {
  it('lista as 9 UPAs e põe no fim as que não atendem a especialidade', async () => {
    render(
      <MemoryRouter initialEntries={['/upas?esp=ortopedia']}>
        <Upas />
      </MemoryRouter>,
    )

    const itens = await screen.findAllByRole('listitem')
    expect(itens).toHaveLength(9)
    const ultimos = itens.slice(-3).map((li) => li.textContent)
    expect(ultimos.every((t) => t?.includes('não atende'))).toBe(true)
    expect(itens[0].textContent).toMatch(/recomendada agora/i)
    expect(await screen.findByTestId('mapa')).toBeInTheDocument()
  })
})
