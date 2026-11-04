# Espera Zero

**Quanto tempo vou esperar, e em qual UPA?**

Site colaborativo que mostra a espera estimada em cada UPA de Belo Horizonte, por especialidade, e ajuda a decidir para onde ir. Abre no navegador do celular, pelo QR code no cartaz da própria UPA: sem download e sem cadastro.

**Site:** https://espera-zero-fc359.web.app (protótipo; os tempos de espera ainda são simulados, e as UPAs, os endereços e os bairros são dados reais da Prefeitura)

Trabalho A03 · Desenvolvimento Web · Ânima BH · Prof. Daniel Henrique Matos de Paiva

---

## O problema

Belo Horizonte tem nove UPAs 24 horas, uma por regional, mas não há informação pública sobre a fila de cada uma, sobre quais especialistas estão de plantão no dia, nem sobre se o caso é mesmo de UPA. A pessoa escolhe pela proximidade, chega, descobre três horas de espera ou a falta do ortopedista, e recomeça em outra unidade.

O Espera Zero junta a **base oficial de unidades da Prefeitura** com a **informação de quem está na fila agora**: cada pessoa atendida informa quanto esperou, e esse tempo vira a estimativa para as próximas.

## O que o site faz

| Função | Como funciona |
| --- | --- |
| **Onde devo ir?** | Triagem orientativa em 4 perguntas: para quem, sinais de alerta, sintoma, desde quando. Termina em SAMU 192, UPA (com a especialidade), centro de saúde ou teleconsulta. **Qualquer sinal de alerta encerra na hora com "Ligue 192".** |
| **Qual UPA eu vou agora?** | Para a especialidade escolhida, soma espera estimada e tempo de trajeto e recomenda uma UPA, explicando por que não é a mais perto quando for o caso. |
| **Onde você está?** | Localização pelo navegador ou busca entre os 493 bairros oficiais (Lei 11.490/2023). A posição é convertida em bairro no próprio celular e nunca é enviada. |
| **Todas as UPAs** | Lista ordenada pelo tempo total, com mapa (OpenStreetMap). UPAs sem a especialidade aparecem no fim, marcadas. |
| **Check-in** | Quem está na fila marca "Cheguei"; o tempo conta mesmo com o navegador fechado; no "Fui atendido", a espera real entra na estimativa. |
| **Como chegar / Avise minha família** | Abre a rota no Google Maps e uma mensagem pronta no WhatsApp, só com UPA, endereço e especialidade. |

Toda estimativa diz de onde veio ("7 relatos · há 5 min") e nenhuma é apresentada como informação oficial.

### Objetivos de Desenvolvimento Sustentável (ONU)

| ODS | Meta | Contribuição |
| --- | --- | --- |
| **3** Saúde e bem-estar | 3.8 · acesso a serviços de saúde essenciais | Encaminhar para a unidade e a especialidade certas reduz o tempo até o atendimento |
| **10** Redução das desigualdades | 10.2 · inclusão | Qualquer celular com navegador, sem cadastro, linguagem simples, acessibilidade WCAG 2.2 AA |
| **16** Instituições eficazes | 16.6 e 16.10 · transparência e acesso à informação | Dado oficial e comunitário, sempre com a origem declarada |

## Arquitetura

Não há servidor próprio. O projeto tem custo zero e nenhum cartão de crédito, e os servidores gratuitos sem cartão "dormem" por inatividade, o que não serve para quem está passando mal. Por isso a arquitetura é **serverless**, com o Firebase fazendo o papel de back-end:

```
Celular (navegador)                          Firebase · plano Spark (grátis)
┌───────────────────────────────┐            ┌─────────────────────────────────┐
│ Site React + TypeScript       │  lê/grava  │ Firestore                       │
│  telas → services/ ───────────┼───────────▶│  Security Rules validam toda    │
│          (mock | firestore)   │            │  gravação (o papel de uma API)  │
│ regras puras (packages/shared)│◀───────────┤ Authentication anônima          │
│  triagem · espera · recomend. │            │ Hosting (site + CDN + HTTPS)    │
└───────────────────────────────┘            └────────────────▲────────────────┘
                                                              │ uma vez por dia
                                             ┌────────────────┴────────────────┐
                                             │ GitHub Actions: sync-pbh.yml    │
                                             │  API de Dados Abertos da PBH    │
                                             └─────────────────────────────────┘
```

| Responsabilidade | Onde fica |
| --- | --- |
| Regras de negócio (triagem, espera, recomendação) | `packages/shared/`: funções puras, testadas, que funcionam sem internet |
| Validação de escrita e antiabuso | `firestore.rules`: um check-in por aparelho a cada 30 min, de 0 a 360 min, com a hora do servidor, sem edição |
| Banco de dados | Firestore: `unidades`, `checkins`, `alertas`, `sugestoesQuadro` |
| Identidade | Login anônimo: um código por aparelho, sem nome, telefone ou e-mail (LGPD) |
| Base oficial das UPAs | `scripts/sync-pbh.ts`, rodado todo dia pelo GitHub Actions |
| Acesso a dados pelo site | `src/services/`: a tela nunca fala direto com o Firestore |

### APIs e serviços externos

| Serviço | Para quê |
| --- | --- |
| **API de Dados Abertos da Prefeitura de BH** (CKAN, conjunto `rede-de-assistencia-saude`) | Lista oficial das UPAs, com endereço e coordenadas |
| **Google Firebase** (Firestore, Authentication, Hosting) | Banco de dados em tempo real, login anônimo e hospedagem |
| **OpenStreetMap** (via Leaflet) | Mapa das UPAs |
| **Geolocation API** do navegador | Descobrir o bairro de quem usa |
| Links do **Google Maps** e do **WhatsApp** (`wa.me`) | Abrir a rota e a mensagem para a família, sem chave de API |

A API paga do Google Maps ficou de fora porque exige cartão de crédito.

## Situação

O projeto está em desenvolvimento, em fases, até a apresentação no Circuito UNI (23/11/2026).

| Parte | Situação |
| --- | --- |
| Estrutura do projeto, regras de segurança do Firestore e seus testes | ✅ na `main` |
| Lógica de tempo e armazenamento local do check-in | ✅ na `main` |
| Dados de referência (UPAs e bairros) e contrato de dados (`docs/CONTRATO.md`) | ✅ na `main` |
| Sincronização diária com a API da Prefeitura | ✅ na `main` |
| Regras de negócio (`packages/shared`) | 🔄 em revisão |
| Telas: início, triagem, recomendação, lista e mapa | 🔄 em revisão, e já publicadas no site |
| Integração do site com Firestore, login anônimo e geolocalização | 🔄 em revisão |
| Tela da UPA e check-in | 🔄 em revisão |

Os pull requests abertos estão em [Pull requests](https://github.com/ricardojunio012-a11y/espera-zero/pulls).

## Como rodar

Requisitos: Node.js 24, npm e Git. Para o emulador do Firebase, também Java 21.

```bash
git clone https://github.com/ricardojunio012-a11y/espera-zero.git
cd espera-zero
npm install
npm run dev
```

O Vite mostra o endereço local (normalmente http://localhost:5173).

> **Windows:** se o PowerShell recusar o `npm` por "execução de scripts desabilitada", use `npm.cmd` no lugar (`npm.cmd install`, `npm.cmd run dev`).

### Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o site em modo de desenvolvimento |
| `npm run lint` | Confere o código com o ESLint |
| `npm run test` | Roda os testes automatizados (Vitest) |
| `npm run build` | Confere os tipos e gera a versão de produção em `dist/` |
| `npm run dev:fire` | Sobe os emuladores do Firebase (Firestore, Auth e Hosting) |
| `npm run sync:pbh` | Busca a base oficial das UPAs na API da Prefeitura e grava no Firestore |

O `sync:pbh` precisa das credenciais do projeto em `FIREBASE_SERVICE_ACCOUNT_JSON` e `FIREBASE_PROJECT_ID`. No GitHub elas ficam nos segredos do repositório.

## Estrutura

```
espera-zero/
├─ src/                    # site React
│  ├─ pages/               # telas
│  ├─ hooks/checkin/       # tempo e armazenamento local do check-in
│  └─ test/                # configuração dos testes
├─ scripts/sync-pbh.ts     # importação da base oficial da Prefeitura
├─ tests/                  # testes das regras do Firestore (rodam no emulador)
├─ docs/                   # contrato de dados e fontes originais
├─ firestore.rules         # validação de toda gravação no banco
├─ firebase.json           # Hosting e emuladores
└─ .github/workflows/      # CI e sincronização diária com a PBH
```

## Tecnologias

React 19 · TypeScript · Vite · React Router · Firebase (Firestore, Authentication, Hosting) · Leaflet + OpenStreetMap · Vitest + Testing Library · Firebase Emulator Suite · GitHub Actions

## Como contribuir

- Uma branch por tarefa, com o id do plano: `feat/t17-modelo-firestore`.
- Nada entra na `main` sem pull request aprovado por outra pessoa do grupo.
- Mudança nos tipos compartilhados (`packages/shared/src/tipos.ts`) vai em PR com o rótulo `contrato`.

## Equipe

| Frente | Responsável |
| --- | --- |
| Gestão e produto | Ricardo Junio |
| UX, UI e acessibilidade | Pedro Leão |
| Front-end A: início, triagem, lista e recomendação | Victor Dias |
| Front-end B: UPA, check-in, quadro e avisos | Miguel Figueiredo |
| Dados e regras de negócio | Davi Oliveira |
| Integrações e DevOps | Caio Araújo |
| Qualidade, documentação e apresentação | Eder Resende |

## Aviso

O Espera Zero é orientação, não diagnóstico, e não substitui a avaliação de um profissional de saúde. Em dúvida ou se piorar, **ligue 192**.
