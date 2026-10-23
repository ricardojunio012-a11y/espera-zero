# Contratos compartilhados — Espera Zero (Integrante 5)

Este documento registra os contratos de `packages/shared`, as assinaturas das funções compartilhadas e as decisões alinhadas pelo grupo.

Antes de integrar em `main`, compare os tipos e assinaturas com os consumidores do site, mocks e serviços. Alterações de contrato compartilhado devem ser enviadas em um PR com o rótulo `contrato`.

As regras documentadas descrevem o comportamento esperado do pacote. A implementação deve ser conferida com os arquivos reais e os testes antes de considerar o contrato congelado.

## 1. Arquivos

- `src/tipos.ts`: tipos compartilhados usados pelo site, mocks, Firestore e testes.
- `src/triagem.ts`: regras determinísticas de orientação, com contexto injetável para regras dependentes de horário.
- `src/espera.ts`: mediana ponderada, janela de duas horas, decaimento temporal, fallback histórico por especialidade, agregação e geração do ID histórico.
- `src/recomendacao.ts`: distância Haversine, tempo de trajeto e recomendação considerando agenda, alertas ativos e horário de referência.
- `src/localizacao.ts`: normalização de texto, transformação de coordenadas, parser WKT e identificação de bairro por polígono ou centro aproximado.
- `src/dados.ts`: exportação de unidades e centros leves de bairros, além de validações estruturais e alertas de compatibilidade.
- `data/unidades.json`: nove UPAs normalizadas com os dados recebidos.
- `data/bairros-centros.json`: dados leves de 493 bairros, sem WKT, incluindo centros aproximados e regionais.
- `public/bairros-geometrias.json`: geometrias WKT simplificadas, separadas para servir como asset estático sob demanda.
- `tests/`: testes de triagem, espera, recomendação e integridade dos dados e da localização.
- `docs/`: fontes originais recebidas, documentação de validação e decisões do contrato.

Os caminhos acima são relativos a `packages/shared`, salvo quando indicados de outra forma.

## 2. Fontes de dados e normalização

### 2.1. UPAs

O arquivo `docs/upas_com_especialidades_atualizado_ORIGINAL.json` foi fornecido com dados de nove UPAs, coordenadas, telefones, especialidades e notas de serviço.

O próprio arquivo solicita confirmação junto à Prefeitura de Belo Horizonte (PBH). Os dados foram normalizados para uso no projeto, mas não devem ser considerados confirmação operacional antes da validação oficial.

As informações de endereço, coordenadas, serviços e especialidades devem ser conferidas com a fonte oficial antes do piloto.

### 2.2. Bairros

Arquivo recebido: `docs/bairros_bh_com_regiao_administrativa_ORIGINAL.json`.

Fonte oficial de referência indicada:

[Portal de Dados Abertos da PBH — Bairro Popular, Lei 11.490/2023](https://dados.pbh.gov.br/dataset/bairro-popular/resource/710e73a6-c0b8-41e5-ad08-b6b9e33564dd).

A referência da camada Bairro Popular informa EPSG:31983 (SIRGAS 2000 / UTM zona 23S) como CRS de visualização. Os valores WKT locais são compatíveis com coordenadas projetadas UTM, mas isso não comprova, por si só, que todas as geometrias locais correspondam à fonte oficial.

A transformação de coordenadas deve ser testada com localizações conhecidas antes de confiar nos resultados de ponto-no-polígono.

### 2.3. Regras de normalização

- As especialidades presentes nos dados recebidos são normalizadas para `clinica`, `pediatria` e `cirurgia-geral` nas nove unidades, além de `ortopedia` nas UPAs Leste, Norte e Oeste.
- O tipo global `Especialidade` também contém `odonto`, pois a triagem e o escopo do projeto contemplam essa categoria. Isso não significa que alguma UPA dos dados recebidos ofereça odontologia.
- Até confirmação oficial, nenhuma UPA deve receber `odonto` em `Unidade.especialidades` nem ser recomendada como prestadora desse serviço com base apenas nesses arquivos.
- As regionais são convertidas para slugs, preservando o valor textual original quando disponível.
- IDs com o prefixo `semente-local:` são provisórios e não representam identificadores oficiais da PBH.
- Os arquivos brutos são preservados em `docs/` para rastreabilidade.

## 3. Assinaturas compartilhadas

As funções públicas compartilhadas devem manter as seguintes assinaturas. Os tipos usados nas assinaturas devem corresponder às definições reais de `src/tipos.ts`.

```ts
triagem(
  r: RespostasTriagem,
  contexto?: ContextoTriagem
): ResultadoTriagem

estimarEspera(
  checkinsConcluidos: Checkin[],
  agoraMs: number,
  especialidade: Checkin['especialidade'],
  historico?: Historico[]
): Estimativa

agregarHistorico(
  checkinsConcluidos: Checkin[],
  atualizadoEm: string
): Historico[]

gerarIdHistorico(
  slug: string,
  especialidade: Checkin['especialidade'],
  dia: DiaSemana,
  hora: number
): string

recomendar(
  unidades: Unidade[],
  esp: Especialidade,
  posicao: { lat: number; lng: number } | null,
  estimativas: Record<string, Estimativa>,
  agendas: Record<string, AgendaDia[]>,
  alertas: Alerta[],
  agora: Date
): Recomendacao[]

distanciaKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number

bairroMaisProximo(
  lat: number,
  lng: number,
  geometrias: GeometriaBairro[],
  centros?: BairroCentro[]
): { bairro: BairroCentro; km: number } | null

normalizar(texto: string): string
```

### 3.1. Compatibilidade das assinaturas

- `agendas` é indexado pelo slug da UPA porque `AgendaDia` não contém um campo `slug`.
- `bairroMaisProximo()` recebe as geometrias já carregadas pelo chamador e pode receber os centros leves de bairros.
- `recomendar()` recebe o horário de referência explicitamente, para que a avaliação da agenda e dos alertas seja testável.
- `estimarEspera()` e `agregarHistorico()` devem receber somente check-ins concluídos.
- Os nomes, parâmetros, retornos e tipos obrigatórios devem ser conferidos com os arquivos reais antes da integração. Se houver divergência com o site, os mocks ou os serviços, ela deve ser resolvida na revisão do contrato, sem alterar silenciosamente a assinatura.

## 4. Regras de triagem

- Os sinais de alerta têm prioridade e encaminham para o SAMU 192 conforme a matriz implementada.
- Trauma/fratura, dor dentária com rosto inchado, atendimento infantil, motivos sem urgência e sintomas leves seguem as regras específicas codificadas em `triagem.ts`.
- `ContextoTriagem.centroSaudeAberto` permite testar regras dependentes do horário sem consultar diretamente o relógio dentro da função.
- A triagem é orientação, não diagnóstico.
- A matriz, os textos e os sinais de alerta precisam de revisão por profissional de saúde antes do piloto.

Os testes devem cobrir as combinações de regras de triagem previstas no escopo, incluindo sinais de alerta e os contextos de horário relevantes.

## 5. Estimativa de espera

### 5.1. Entrada e filtragem

- A função recebe apenas check-ins concluídos, já filtrados para a UPA correspondente pelo serviço chamador.
- A função filtra os check-ins pela especialidade indicada.
- São considerados minutos inteiros de 0 a 360 e relatos criados nos últimos 120 minutos.
- Check-ins ativos, ainda não concluídos, não podem ser usados para estimar a espera nem para agregar o histórico.

### 5.2. Peso temporal

A meia-vida temporal é de 45 minutos, conforme RN-09 do Escopo e da Arquitetura:

`peso = 0,5^(idadeEmMinutos / 45)`

Relatos mais recentes recebem maior peso no cálculo.

### 5.3. Confiança e fallback

A classificação de confiança é:

- Menos de 3 relatos válidos: baixa.
- De 3 a 5 relatos válidos: média.
- 6 ou mais relatos válidos: alta.

Sem relatos válidos, a função tenta utilizar o histórico da mesma especialidade, dia da semana e hora.

Sem histórico compatível, retorna `minutos: null` e `origem: 'sem-dados'`. A ausência de dados não deve ser substituída por uma estimativa inventada.

Com um único relato e histórico coincidente, o resultado fica limitado a ±15 minutos do histórico. Sem histórico comparável, não existe uma base histórica para aplicar esse limite; o comportamento nesse caso deve permanecer explícito nos testes e na documentação.

## 6. Check-ins concluídos

O check-in ativo permanece em `localStorage`, na chave `ez.checkin`.

O banco recebe o registro quando a pessoa clica em **“Fui atendido”**. Portanto, os documentos em `checkins/` representam check-ins concluídos.

O tipo `Checkin` não precisa de um campo de estado apenas para representar esse fluxo, desde que a implementação mantenha a regra de persistência descrita acima.

O front-end e os serviços são responsáveis por não enviar check-ins ativos para `estimarEspera()` ou `agregarHistorico()`.

A persistência no banco e as Security Rules estão fora deste pacote compartilhado, mas devem respeitar a mesma decisão.

## 7. Histórico por especialidade

- `Historico.especialidade` é obrigatório.
- O agregador separa os dados por UPA (`slug`), especialidade, dia da semana e hora.
- `gerarIdHistorico()` produz o padrão acordado: `{slug}{especialidade}{dia}_{hora}`.
- A camada de persistência deve usar esse gerador ao gravar documentos em `historico/`.
- Documentos antigos sem especialidade não devem ser usados como fallback de outra especialidade. Devem ser migrados ou ignorados conforme decisão da camada de serviços.

Os testes devem verificar que históricos de especialidades diferentes não são misturados e que o ID gerado respeita o padrão acordado.

## 8. Recomendação e disponibilidade

A função `recomendar()` recebe unidades, especialidade, posição, estimativas, agendas por slug, alertas e horário de referência.

### 8.1. Critérios de elegibilidade

Uma unidade só pode aparecer no resultado se:

1. Possuir a especialidade solicitada em `Unidade.especialidades`.
2. Possuir agenda para o dia da semana consultado e estar dentro do horário válido.
3. Não possuir um alerta ativo `sem-profissional` aplicável à UPA e à especialidade no instante consultado.

Regras de horário:

- O início do horário é inclusivo e o fim é exclusivo.
- Intervalos que atravessam a meia-noite são aceitos.
- O horário `24h` indica funcionamento durante todo o dia.
- O horário `nao`, a ausência de agenda ou um horário inválido não autorizam a recomendação.

Regras de alerta:

- Alertas ativos `sem-profissional` aplicáveis à UPA e à especialidade removem a unidade.
- Alertas expirados, futuros ou de outra especialidade não removem a unidade.
- Um alerta sem especialidade é tratado como aplicável a todas as especialidades daquela UPA.
- Se houver múltiplas agendas conflitantes para o mesmo dia, a precedência precisa ser resolvida antes de fornecer a agenda à função.

O chamador deve fornecer o horário no fuso local usado pelo produto.

### 8.2. Campo `atendeAgora`

O tipo `Recomendacao` deve conter a propriedade:

```ts
atendeAgora: boolean;
```

Na implementação atual, a função filtra as unidades por especialidade, horário e alertas impeditivos antes de montar os objetos de recomendação.

Por isso, o objeto retornado pode incluir:

```ts
atendeAgora: true,
```

Essa atribuição é coerente enquanto os filtros anteriores continuarem garantindo todos os critérios de elegibilidade descritos nesta seção.

Se a implementação passar a devolver unidades fora desses critérios, ou se os filtros forem removidos ou alterados, o cálculo desse campo deverá ser revisto. Não se deve definir `atendeAgora: true` indiscriminadamente em um fluxo que também permita unidades inelegíveis.

**Significado do campo:** `atendeAgora: true` indica que a unidade passou pelos critérios de agenda e alertas considerados pela função no horário de referência. Não garante a existência de vaga, a presença física de um profissional ou o atendimento imediato.

### 8.3. Ordenação

A função ordena as recomendações por espera estimada mais trajeto, quando há estimativa disponível.

- Itens sem estimativa ficam ao final.
- Quando os totais são iguais ou indisponíveis, são aplicados os critérios secundários implementados, incluindo quantidade de relatos, trajeto quando disponível e slug.
- A ausência de estimativa não deve ser substituída por um valor inventado.
- O motivo apresentado deve indicar a origem da estimativa e as limitações relevantes dos dados.

## 9. Tempo de trajeto

Conforme RN-08 do Escopo e da Arquitetura, o cálculo utiliza:

- Distância Haversine entre as coordenadas.
- Fator de rota: `1,3`.
- Velocidade média: `22 km/h`.
- Tempo mínimo: `3 minutos`.

A fórmula implementada é:

`Math.max(3, Math.ceil((distanciaKm * 1.3 / 22) * 60))`

O resultado é uma estimativa aproximada, não uma previsão de trânsito em tempo real.

Quando a posição da pessoa não estiver disponível, `trajetoMin` deve permanecer `null`; a função não deve inventar uma distância ou um tempo de trajeto.

## 10. Geolocalização e geometrias

- `src/dados.ts` importa apenas os centros leves de `data/bairros-centros.json`.
- As geometrias WKT ficam em `public/bairros-geometrias.json` e não devem ser importadas por módulos carregados no início da aplicação.
- O front-end deve carregar o asset de geometrias sob demanda, após a pessoa conceder a permissão necessária para utilizar a localização, e passar as geometrias carregadas a `bairroMaisProximo()`.
- Os centros leves dos bairros devem permanecer separados do arquivo de geometrias completas.

### 10.1. CRS e simplificação

O asset atual usa geometrias simplificadas com tolerância registrada de 8 unidades presumidas métricas. Essa tolerância deve ser reavaliada depois da confirmação do CRS e da validação das geometrias.

A referência oficial da camada Bairro Popular informa EPSG:31983 (SIRGAS 2000 / UTM zona 23S). EPSG:4674 (SIRGAS 2000 geográfico) e EPSG:4326 (WGS 84 geográfico) são CRS distintos; a conversão deve utilizar uma transformação explícita e adequada.

A compatibilidade aparente dos valores com coordenadas UTM não comprova que todos os registros locais foram transformados corretamente.

### 10.2. Busca do bairro

A função `bairroMaisProximo()` verifica primeiro se o ponto está dentro de algum polígono carregado.

Se o ponto não cair em nenhum polígono, a função retorna o centro de bairro aproximado mais próximo, quando houver centros disponíveis. Esse resultado é um fallback aproximado, não uma confirmação de que a pessoa está dentro dos limites oficiais daquele bairro.

A correspondência dos 493 registros locais com a fonte oficial da PBH ainda precisa ser validada.

## 11. Pendências antes do piloto

As pendências a seguir não devem ser consideradas resolvidas apenas porque os contratos TypeScript estão definidos.

1. **Especialidades das UPAs:** os dados recebidos listam clínica médica, pediatria e cirurgia geral nas nove unidades, além de ortopedia nas UPAs Leste, Norte e Oeste. Confirmar a oferta de serviços com a PBH antes do uso operacional.
2. **IDs da PBH:** substituir IDs provisórios `semente-local:` por identificadores oficiais quando o responsável pelos dados realizar a sincronização.
3. **Revisão clínica:** obter revisão profissional da matriz de triagem, dos sinais de alerta e dos textos.

## 12. Validação e testes

Dentro de `packages/shared`, execute os comandos disponíveis no `package.json` do pacote:

```bash
npm install
npm run typecheck
npm test
```

No Windows PowerShell, se a política de execução bloquear `npm`, utilize:

```powershell
npm.cmd install
npm.cmd run typecheck
npm.cmd test
```

Em um monorepo com pnpm, adapte os comandos ao workspace e confirme que `packages/shared` está incluído no `pnpm-workspace.yaml`.

Antes do merge:

- Confirme que `typecheck` termina sem erros.
- Execute todos os testes do pacote.
- Verifique as assinaturas reais e os tipos obrigatórios.
- Verifique os IDs do histórico e a separação por especialidade.
- Teste agendas válidas, horários que atravessam a meia-noite e alertas ativos, expirados, futuros ou de outra especialidade.
- Confirme o comportamento de `atendeAgora`.
- Confirme o filtro de check-ins concluídos.
- Verifique o carregamento geográfico sob demanda.
- Não versione `node_modules`.

O contrato só deve ser considerado congelado após a validação técnica e a revisão dos integrantes responsáveis pelos consumidores das interfaces compartilhadas.