import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import Upa from './pages/Upa'
import { ServicosProvider } from './services'
import './App.css'

function App() {
  return (
    <ServicosProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/u/:slug" element={<Upa />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ServicosProvider>
  )
}

export default App
