import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Home from './Home'

describe('Página inicial', () => {
  it('deve exibir o nome Espera Zero', () => {
    render(<Home />)

    expect(
      screen.getByRole('heading', { name: 'Espera Zero' }),
    ).toBeInTheDocument()
  })
})