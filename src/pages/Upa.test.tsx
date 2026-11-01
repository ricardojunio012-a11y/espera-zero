import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ServicosProvider, type Servicos } from '../services'
import { criarServicosMock, type ServicosMock } from '../services/mock'
import Upa from './Upa'

function abrir(caminho: string, servicos: Servicos = criarServicosMock()) {
  return render(
    <ServicosProvider servicos={servicos}>
      <MemoryRouter initialEntries={[caminho]}>
        <Routes>
          <Route path="/u/:slug" element={<Upa />} />
        </Routes>
      </MemoryRouter>
    </ServicosProvider>,
  )
}

const titulo = (nome: string) => screen.findByRole('heading', { level: 1, name: nome })
const cartao = (nome: string) => screen.getByRole('region', { name: nome })

afterEach(() => vi.unstubAllGlobals())

describe('Tela da UPA (/u/:slug) — tela 11 do Figma', () => {
  describe('rota e estados', () => {
    it('abre direto pelo slug, com um único h1 e os quatro cartões', async () => {
      abrir('/u/leste')
      await titulo('UPA Leste')
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
        'Agora',
        'Check-in',
        'Avisos de hoje',
        'Quadro da semana',
      ])
    })

    it('mostra carregando primeiro e depois a UPA', async () => {
      abrir('/u/leste', criarServicosMock({ latenciaMs: 20 }))
      expect(screen.getByRole('heading', { level: 1, name: 'Abrindo a UPA' })).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Carregando')
      await titulo('UPA Leste')
    })

    it('slug inexistente: "UPA não encontrada" com link para /upas', async () => {
      abrir('/u/nao-existe')
      await titulo('UPA não encontrada')
      expect(screen.getByRole('link', { name: 'Ver todas as UPAs' })).toHaveAttribute('href', '/upas')
    })

    it.each([
      ['offline', 'Sem conexão'],
      ['permissao', 'permissão'],
      ['desconhecido', 'Algo deu errado'],
    ] as const)('erro "%s" mostra a mensagem do código e permite tentar de novo', async (codigo, trecho) => {
      const servicos: ServicosMock = criarServicosMock()
      servicos.simularErro(codigo)
      abrir('/u/leste', servicos)

      expect(await screen.findByRole('alert')).toHaveTextContent(trecho)
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Não foi possível abrir a UPA')

      servicos.simularErro(null)
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
      await titulo('UPA Leste')
    })
  })

  describe('topo e como chegar', () => {
    it('mostra endereço e bairro em texto selecionável', async () => {
      abrir('/u/leste')
      await titulo('UPA Leste')
      expect(screen.getByText('Avenida dos Andradas, 7450 · Vera Cruz')).toBeInTheDocument()
    })

    it('"Como chegar" é um link do Google Maps com lat,lng da UPA, em nova aba', async () => {
      abrir('/u/leste')
      await titulo('UPA Leste')
      const link = screen.getByRole('link', { name: /Como chegar/ })
      expect(link).toHaveAttribute(
        'href',
        'https://www.google.com/maps/dir/?api=1&destination=-19.905685,-43.896646&travelmode=driving',
      )
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(link).toHaveAccessibleName(/abre em uma nova aba/)
    })

    it('voltar leva para a lista de UPAs (o QR pode ser a 1ª página da sessão)', async () => {
      abrir('/u/leste')
      await titulo('UPA Leste')
      expect(screen.getByRole('link', { name: 'Voltar para a lista de UPAs' })).toHaveAttribute('href', '/upas')
    })

    it('compartilhar usa o compartilhamento do sistema quando existe', async () => {
      const share = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, share })
      abrir('/u/leste')
      await titulo('UPA Leste')
      fireEvent.click(screen.getByRole('button', { name: 'Compartilhar esta UPA' }))
      await waitFor(() =>
        expect(share).toHaveBeenCalledWith({ title: 'UPA Leste', url: window.location.href }),
      )
    })

    it('sem compartilhamento do sistema, copia o link e avisa; se falhar, avisa também', async () => {
      const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('negado'))
      vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } })
      abrir('/u/leste')
      await titulo('UPA Leste')
      const botao = screen.getByRole('button', { name: 'Compartilhar esta UPA' })

      fireEvent.click(botao)
      expect(await screen.findByText('Link copiado.')).toBeInTheDocument()
      expect(writeText).toHaveBeenCalledWith(window.location.href)

      fireEvent.click(botao)
      expect(await screen.findByText('Não deu para copiar o link.')).toBeInTheDocument()
    })

    it('fechar a folha de compartilhamento (AbortError) não vira mensagem de erro', async () => {
      const share = vi.fn().mockRejectedValue(new DOMException('fechou', 'AbortError'))
      vi.stubGlobal('navigator', { ...navigator, share })
      abrir('/u/leste')
      await titulo('UPA Leste')
      fireEvent.click(screen.getByRole('button', { name: 'Compartilhar esta UPA' }))
      await waitFor(() => expect(share).toHaveBeenCalled())
      expect(screen.queryByText('Não deu para copiar o link.')).not.toBeInTheDocument()
    })
  })

  describe('cartão "Agora"', () => {
    it('lista as 4 especialidades na ordem do Figma, com situação e espera', async () => {
      abrir('/u/leste')
      await titulo('UPA Leste')
      const agora = within(cartao('Agora'))
      const nomes = agora.getAllByRole('listitem').map((li) => li.querySelector('.upa-linha-nome')?.textContent)
      expect(nomes).toEqual(['Clínica médica', 'Pediatria', 'Ortopedia', 'Odontologia'])

      const clinica = agora.getByText('Clínica médica').closest('li')!
      await waitFor(() =>
        expect(clinica).toHaveTextContent('25 minutos, 3 relatos, há 5 minutos'), // RN-24, para leitor de tela
      )
      expect(clinica).toHaveTextContent('24 horas')
      expect(clinica.querySelector('.upa-faixa--curta')).not.toBeNull() // 25 min: faixa verde
      expect(clinica.querySelector('.upa-trilho-preenchimento')).not.toBeNull()

      expect(agora.getByText('Ortopedia').closest('li')).toHaveTextContent('não atende')
      expect(agora.getByText('Odontologia').closest('li')).toHaveTextContent('não atende')
    })

    it('o selo do cartão traz o total de relatos e a idade do mais recente (RN-24)', async () => {
      abrir('/u/leste')
      await titulo('UPA Leste')
      await waitFor(() => expect(cartao('Agora')).toHaveTextContent(/\d+ relatos · há 5 min/))
    })

    it('sem relatos recentes, o selo e a linha dizem "sem informação recente" e não inventam número', async () => {
      // O relógio do mock anda 3 h atrás: os relatos semeados ficam velhos demais (limite de 2 h).
      abrir('/u/leste', criarServicosMock({ agora: () => Date.now() - 3 * 3_600_000 }))
      await titulo('UPA Leste')
      const agora = within(cartao('Agora'))
      expect(agora.getAllByText('sem informação recente').length).toBeGreaterThanOrEqual(2) // selo + clínica
      const clinica = agora.getByText('Clínica médica').closest('li')!
      expect(clinica).toHaveTextContent('sem informação recente')
      expect(clinica.querySelector('.upa-min')).toBeNull()
      expect(clinica.querySelector('.upa-trilho')).toBeNull()
    })

    it('rodapé explica de onde vem a espera', async () => {
      abrir('/u/leste')
      await titulo('UPA Leste')
      expect(
        within(cartao('Agora')).getByText(/Espera estimada a partir dos check-ins de quem está na unidade/),
      ).toBeInTheDocument()
    })

    it('a região aria-live anuncia só situação e minutos, e muda quando chega relato novo', async () => {
      const servicos = criarServicosMock()
      abrir('/u/leste', servicos)
      await titulo('UPA Leste')
      const regiao = document.querySelector('[aria-live="polite"][aria-atomic="true"]')!
      await waitFor(() => expect(regiao).toHaveTextContent('Clínica médica: atende agora, 25 min.'))
      expect(regiao.textContent).not.toMatch(/há \d+ min/)

      await act(() => servicos.registrarCheckin({ slug: 'leste', especialidade: 'clinica', minutos: 100 }))
      // mediana de [25, 30, 20, 100] = 27,5, arredondada para 28
      await waitFor(() => expect(regiao).toHaveTextContent('Clínica médica: atende agora, 28 min.'))
    })

    it('não rouba o foco quando a situação atualiza', async () => {
      const servicos = criarServicosMock()
      abrir('/u/leste', servicos)
      await titulo('UPA Leste')
      const botao = screen.getByRole('button', { name: 'Compartilhar esta UPA' })
      botao.focus()
      await act(() => servicos.registrarCheckin({ slug: 'leste', especialidade: 'clinica', minutos: 100 }))
      expect(botao).toHaveFocus()
    })
  })

  describe('cartão "Check-in" e ?esp=', () => {
    it('explica o fluxo e mostra o botão Cheguei', async () => {
      abrir('/u/leste')
      await titulo('UPA Leste')
      const checkin = within(cartao('Check-in'))
      expect(checkin.getByText(/O tempo continua contando mesmo se você fechar o navegador/)).toBeInTheDocument()
      expect(checkin.getByRole('button', { name: 'Cheguei' })).toBeEnabled()
    })

    it('?esp= válido pré-seleciona a especialidade do check-in', async () => {
      abrir('/u/leste?esp=ortopedia')
      await titulo('UPA Leste')
      expect(screen.getByRole('button', { name: 'Cheguei' })).toHaveAttribute('data-especialidade', 'ortopedia')
    })

    it('?esp= que a UPA não oferece cai na primeira especialidade', async () => {
      abrir('/u/barreiro?esp=ortopedia')
      await titulo('UPA Barreiro')
      expect(screen.getByRole('button', { name: 'Cheguei' })).toHaveAttribute('data-especialidade', 'clinica')
    })
  })

  describe('cartão "Avisos de hoje"', () => {
    it('lista os avisos ativos com idade, pessoas e expiração', async () => {
      abrir('/u/leste')
      await titulo('UPA Leste')
      const avisos = within(cartao('Avisos de hoje'))
      expect(avisos.getByText('Raio-x parado')).toBeInTheDocument()
      expect(avisos.getByText(/há 40 min · 2 pessoas · expira em 5h/)).toBeInTheDocument()
      expect(avisos.getByText(/Avisos somem sozinhos depois de 6 horas/)).toBeInTheDocument()
    })

    it('sem avisos: estado vazio', async () => {
      abrir('/u/barreiro')
      await titulo('UPA Barreiro')
      expect(within(cartao('Avisos de hoje')).getByText('Nenhum aviso ativo agora.')).toBeInTheDocument()
    })
  })

  describe('cartão "Quadro da semana"', () => {
    it('tabela com os 7 dias, só as especialidades que atendem, e o dia de hoje marcado', async () => {
      abrir('/u/leste')
      await titulo('UPA Leste')
      const quadro = within(cartao('Quadro da semana'))
      const tabela = quadro.getByRole('table', { name: /Dias da semana em que cada especialidade atende/ })

      const dias = within(tabela).getAllByRole('columnheader').map((c) => c.textContent)
      expect(dias).toEqual(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'])
      const linhas = within(tabela).getAllByRole('rowheader').map((r) => r.textContent)
      expect(linhas).toEqual(['Clínica', 'Pediatria'])

      expect(within(tabela).getAllByRole('columnheader', { current: 'date' })).toHaveLength(1)
      expect(within(tabela).getAllByText('atende').length).toBe(14) // 2 especialidades x 7 dias
    })

    it('legenda por especialidade e a lista de quem não atende', async () => {
      abrir('/u/leste')
      await titulo('UPA Leste')
      const quadro = within(cartao('Quadro da semana'))
      expect(quadro.getByText('Clínica médica:').parentElement).toHaveTextContent('todos os dias, 24 horas')
      expect(quadro.getByText('Pediatria:').parentElement).toHaveTextContent('todos os dias, 7h às 19h')
      expect(quadro.getByText('Não atende:').parentElement).toHaveTextContent('ortopedia, odontologia')
    })

    it('RN-20: diz que foi montado pela comunidade e que não é oficial', async () => {
      abrir('/u/leste')
      await titulo('UPA Leste')
      expect(cartao('Quadro da semana')).toHaveTextContent(
        'Escala montada pela comunidade, ainda sem confirmações. Não é informação oficial da prefeitura.',
      )
    })

    it('"Sugerir correção" leva ao quadro da UPA', async () => {
      abrir('/u/leste')
      await titulo('UPA Leste')
      expect(screen.getByRole('link', { name: 'Sugerir correção' })).toHaveAttribute('href', '/u/leste/quadro')
    })
  })

  describe('assinatura de check-ins', () => {
    function espiar() {
      const base = criarServicosMock()
      const assinaturas = { abertas: 0, canceladas: 0 }
      const servicos: Servicos = {
        ...base,
        observarCheckins(slug, desdeMs, cb) {
          assinaturas.abertas++
          const cancelar = base.observarCheckins(slug, desdeMs, cb)
          let jaCancelou = false
          return () => {
            if (!jaCancelou) assinaturas.canceladas++
            jaCancelou = true
            cancelar()
          }
        },
      }
      return { servicos, assinaturas }
    }

    it('assina ao abrir a UPA e cancela ao sair da página (sem ouvinte vazando)', async () => {
      const { servicos, assinaturas } = espiar()
      const { unmount } = abrir('/u/leste', servicos)
      await titulo('UPA Leste')
      expect(assinaturas.abertas).toBe(1)
      expect(assinaturas.canceladas).toBe(0)

      unmount()
      expect(assinaturas.canceladas).toBe(assinaturas.abertas)
    })

    it('slug inexistente não assina nada', async () => {
      const { servicos, assinaturas } = espiar()
      abrir('/u/nao-existe', servicos)
      await titulo('UPA não encontrada')
      expect(assinaturas.abertas).toBe(0)
    })
  })
})
