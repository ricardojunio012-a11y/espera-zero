import type { Especialidade, Unidade } from '../../services/tipos-provisorios'

/**
 * Especialidade pré-selecionada ao abrir /u/:slug?esp=... (vai para o sheet de check-in).
 * O parâmetro só vale se a UPA oferece a especialidade; senão cai na primeira da lista.
 */
export function especialidadeInicial(unidade: Unidade, parametro: string | null): Especialidade | null {
  return unidade.especialidades.find((e) => e === parametro) ?? unidade.especialidades[0] ?? null
}
