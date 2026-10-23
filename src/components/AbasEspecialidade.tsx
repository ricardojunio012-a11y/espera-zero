import type { Especialidade } from '@espera-zero/shared'
import { ESPECIALIDADES } from '../lib/upas'

interface Props {
  valor: Especialidade
  onMudar: (esp: Especialidade) => void
}

export default function AbasEspecialidade({ valor, onMudar }: Props) {
  return (
    <div className="abas" role="group" aria-label="Especialidade">
      {ESPECIALIDADES.map((esp) => (
        <button
          key={esp.id}
          type="button"
          className="aba"
          aria-pressed={esp.id === valor}
          onClick={() => onMudar(esp.id)}
        >
          {esp.nome}
        </button>
      ))}
    </div>
  )
}
