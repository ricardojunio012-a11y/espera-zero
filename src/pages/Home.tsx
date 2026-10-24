import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import QualUpa from '../components/QualUpa'

export default function Home() {
  return (
    <Layout>
      <Link to="/triagem" className="chamada-triagem">
        <span>
          <span className="chamada-titulo">Onde devo ir?</span>
          <span className="chamada-texto">SAMU, UPA, centro de saúde ou teleconsulta, em 4 perguntas.</span>
        </span>
        <span className="chamada-botao" aria-hidden="true">Começar ›</span>
      </Link>
      <QualUpa modo="recomendacao" />
    </Layout>
  )
}
