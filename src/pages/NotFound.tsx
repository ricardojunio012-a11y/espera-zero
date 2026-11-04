import { Link } from 'react-router-dom'
import Layout from '../components/Layout'

export default function NotFound() {
  return (
    <Layout>
      <h2>Página não encontrada</h2>
      <p>Verifique o endereço ou <Link to="/">volte para o início</Link>.</p>
    </Layout>
  )
}
