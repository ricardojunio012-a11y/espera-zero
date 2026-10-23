import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <header className="cabecalho">
        <Link to="/" className="marca">
          <span className="marca-icone" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h4l2-5 4 10 2-5h6" />
            </svg>
          </span>
          <span>
            <h1 className="marca-nome">Espera Zero</h1>
            <span className="marca-sub">protótipo · Belo Horizonte</span>
          </span>
        </Link>
      </header>
      <main className="conteudo">{children}</main>
      <footer className="rodape">
        <p>Orientação, não diagnóstico. Em dúvida ou se piorar, ligue <strong>192</strong>.</p>
      </footer>
    </div>
  )
}
