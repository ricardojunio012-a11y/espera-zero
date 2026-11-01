import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { ServicosProvider, useServicos } from './index'
import { criarServicosMock } from './mock'

describe('useServicos', () => {
  it('devolve a instância injetada no provider e a mantém entre renders', () => {
    const injetado = criarServicosMock()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ServicosProvider servicos={injetado}>{children}</ServicosProvider>
    )
    const { result, rerender } = renderHook(() => useServicos(), { wrapper })
    expect(result.current).toBe(injetado)
    rerender()
    expect(result.current).toBe(injetado)
  })

  it('sem provider, cai na instância padrão (mock) e ela é sempre a mesma', async () => {
    const a = renderHook(() => useServicos()).result.current
    const b = renderHook(() => useServicos()).result.current
    expect(a).toBe(b)
    expect(await a.garantirSessao()).toBe('mock-uid-1')
  })
})
