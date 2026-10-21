import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Triagem() {
  const [passo, setPasso] = useState(1);
  const [sintoma, setSintoma] = useState('');
  const [resultado, setResultado] = useState('');
  const navigate = useNavigate();

  const handleSelecionarSintoma = (tipo: string) => {
    setSintoma(tipo);
    if (tipo === 'leve') {
      setResultado('teleconsulta');
    } else {
      setResultado('upa');
    }
    setPasso(2); // Avança para a tela de resultado da triagem
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Triagem de Saúde</h1>
      <p style={{ color: '#666' }}>Passo {passo} de 2</p>

      {passo === 1 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3>Qual é o sintoma principal que está a sentir?</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <button 
              onClick={() => handleSelecionarSintoma('grave')}
              style={{ padding: '0.75rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' }}
            >
              🚨 Dor forte no peito / Falta de ar grave
            </button>

            <button 
              onClick={() => handleSelecionarSintoma('moderado')}
              style={{ padding: '0.75rem', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' }}
            >
              ⚠️ Febre alta persistente / Dor de cabeça forte
            </button>

            <button 
              onClick={() => handleSelecionarSintoma('leve')}
              style={{ padding: '0.75rem', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' }}
            >
              ℹ️ Sintomas leves (Gripe, tosse fraca, indisposição)
            </button>
          </div>
        </div>
      )}

      {passo === 2 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3>Resultado da Triagem</h3>
          
          {resultado === 'upa' ? (
            <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
              <p style={{ color: '#991b1b', fontWeight: 'bold', margin: 0 }}>
                Recomendação: Atendimento Presencial em UPA
              </p>
              <p style={{ color: '#7f1d1d', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Devido aos sintomas relatados, recomendamos que se dirija a uma unidade de urgência em Belo Horizonte o mais rápido possível.
              </p>
            </div>
          ) : (
            <div style={{ backgroundColor: '#e0f2fe', border: '1px solid #bae6fd', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
              <p style={{ color: '#0369a1', fontWeight: 'bold', margin: 0 }}>
                Recomendação: Teleconsulta / Cuidados em Casa
              </p>
              <p style={{ color: '#075985', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Os sintomas indicam um quadro leve. Pode optar por atendimento remoto para evitar filas nas unidades.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={() => setPasso(1)}
              style={{ flex: 1, padding: '0.75rem', backgroundColor: '#6b7280', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ← Refazer
            </button>

            <button 
              onClick={() => alert('Em breve: Listagem das UPAs de BH baseada na sua localização!')}
              style={{ flex: 1, padding: '0.75rem', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Ver UPAs Próximas →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}