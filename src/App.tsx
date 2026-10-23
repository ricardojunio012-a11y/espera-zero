
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Upas from './pages/Upas'
import NotFound from './pages/NotFound'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upas" element={<Upas />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
