
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Triagem from './pages/Triagem';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/triagem" element={<Triagem />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;