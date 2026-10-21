import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const [bairro, setBairro] = useState('');
  const navigate = useNavigate();

  const handleUsarGps = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          alert(`Localização detectada! Lat: ${position.coords.latitude}`);
          navigate('/triagem');
        },
        () => alert('Não foi possível obter a sua localização. Escolha o bairro na lista.')
      );
    }
  };

  const handleIniciarTriagem = () => {
    alert(`O bairro selecionado é: "${bairro}"`); // <--- Isto vai nos mostrar se o bairro foi capturado
    if (bairro) {
      localStorage.setItem('ez.place', bairro);
      navigate('/triagem');
    } else {
      alert('Por favor, selecione um bairro primeiro!');
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Espera Zero</h1>
      <p>Encontre informações sobre as UPAs de Belo Horizonte e descubra a melhor opção para seu atendimento.</p>

      {/* Opção 1: GPS */}
      <div style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>
        <button 
          onClick={handleUsarGps}
          style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          📍 Usar minha localização atual (GPS)
        </button>
      </div>

      <p style={{ textAlign: 'center', color: '#666' }}>— OU —</p>

      {/* Opção 2: Selecionar Bairro */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label htmlFor="bairro" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Selecione o seu bairro em BH:
        </label>
        <select 
          id="bairro" 
          value={bairro} 
          onChange={(e) => setBairro(e.target.value)}
          style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #ccc' }}
        >
          <option value="">-- Escolha um bairro --</option>
          <option value="centro">Centro</option>
          <option value="barreiro">Barreiro</option>
          <option value="venda-nova">Venda Nova</option>
          <option value="pampulha">Pampulha</option>
          <option value="norte">Região Norte</option>
        </select>
      </div>

      {/* Botão de Avançar */}
      <button 
        disabled={!bairro}
        onClick={handleIniciarTriagem}
        style={{ 
          width: '100%', 
          padding: '0.75rem', 
          backgroundColor: bairro ? '#16a34a' : '#cbd5e1', 
          color: '#fff', 
          border: 'none', 
          borderRadius: '6px', 
          cursor: bairro ? 'pointer' : 'not-allowed',
          fontWeight: 'bold'
        }}
      >
        Ir para a Triagem →
      </button>
    </main>
  );
}