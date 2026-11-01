import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ptBR } from '../../i18n/pt-BR'
import type { Unidade } from '../../services/tipos-provisorios'
import { IconeCompartilhar, IconeVoltar } from './icones'

const t = ptBR.upa.barra

/** Barra do topo da tela 11: voltar, nome da UPA e compartilhar. */
export default function BarraTopo({ unidade }: { unidade: Unidade }) {
  const [aviso, setAviso] = useState('')

  async function compartilhar() {
    const dados = { title: unidade.nome, url: window.location.href }
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(dados)
        return
      }
      await navigator.clipboard.writeText(dados.url)
      setAviso(t.linkCopiado)
    } catch (e) {
      // Fechar a folha de compartilhamento do sistema também rejeita; não é erro.
      if (e instanceof DOMException && e.name === 'AbortError') return
      setAviso(t.naoCopiou)
    }
  }

  return (
    <div className="upa-barra">
      {/* O QR code pode ser a primeira página da sessão (sem histórico): por isso é link, não "voltar". */}
      <Link to="/upas" className="upa-barra-botao" aria-label={t.voltar}>
        <IconeVoltar />
      </Link>
      {/* O nome já é o h1 logo abaixo; aqui é só visual. */}
      <span className="upa-barra-titulo" aria-hidden="true">
        {unidade.nome}
      </span>
      <button type="button" className="upa-barra-botao" aria-label={t.compartilhar} onClick={compartilhar}>
        <IconeCompartilhar />
      </button>
      <p role="status" className="so-leitor">
        {aviso}
      </p>
    </div>
  )
}
