# Espera Zero

Site colaborativo que mostra quanto tempo se espera em cada UPA de Belo Horizonte, por especialidade, e ajuda a decidir para onde ir. Abre pelo navegador do celular, pelo QR code da própria UPA: sem download e sem cadastro.

Trabalho A03 · Desenvolvimento Web · Ânima BH · ODS 3, 10 e 16.

**Site:** https://espera-zero-fc359.web.app

## O que o site faz

| Função | Onde está |
|---|---|
| **Onde devo ir?** Triagem orientativa: SAMU 192, UPA com especialidade, centro de saúde ou teleconsulta. Qualquer sinal de alerta encerra com "Ligue 192". | `packages/shared/src/triagem.ts`, `src/pages/Triagem.tsx` |
| **Qual UPA eu vou agora?** Espera estimada + tempo de trajeto, com o motivo da recomendação. | `packages/shared/src/recomendacao.ts`, `src/components/QualUpa.tsx` |
| **Check-in.** Quem está na fila informa a especialidade; o tempo conta mesmo com o navegador fechado e, no "Fui atendido", vira dado para os próximos. | `src/hooks/checkin/`, `src/services/` |
| **Espera estimada.** Mediana ponderada dos check-ins das últimas 2 h, com o peso caindo pela metade a cada 45 min. Toda estimativa diz de onde veio. | `packages/shared/src/espera.ts` |
| **Avisos e quadro da semana.** A comunidade publica, confirma e contesta. | `firestore.rules` (regras); telas na fase 2 |

## Arquitetura

Não existe servidor próprio. A restrição do projeto é custo zero sem cartão de crédito (ADR-000), e os serviços de servidor do Google (Cloud Run, Cloud Functions) exigem conta de faturamento. Os gratuitos sem cartão dormem por inatividade, o que não serve para quem está passando mal. Por isso a arquitetura é **serverless com Backend as a Service**:

```
Celular (navegador)                         Firebase · plano Spark (grátis)
┌──────────────────────────────┐            ┌─────────────────────────────────┐
│ Site React + TypeScript      │  lê/grava  │ Firestore                       │
│  telas  →  services/  ───────┼───────────▶│  Security Rules validam toda    │
│            (mock | firestore)│ tempo real │  gravação (o papel da API)      │
│ regras puras (packages/shared)│◀──────────┤ Authentication anônima (1 uid)  │
│  triagem · espera · recomend. │            │ Hosting (site + CDN + HTTPS)    │
└──────────────────────────────┘            └────────────────▲────────────────┘
                                                             │ Admin SDK, 1×/dia
                                            ┌────────────────┴────────────────┐
                                            │ GitHub Actions: sync-pbh.yml    │
                                            │  lê os Dados Abertos da PBH     │
                                            └─────────────────────────────────┘
```

O que seria "o back-end" em uma arquitetura com servidor está dividido assim:

| Responsabilidade | Onde fica | Por quê |
|---|---|---|
| Regras de negócio (triagem, espera, recomendação) | `packages/shared/`: funções puras, sem rede nem relógio, com testes | Funcionam offline, qualquer pessoa pode auditar e o mesmo código serviria a uma API depois |
| Validação de escrita e antiabuso | `firestore.rules`, executadas no servidor do Google | Um check-in por aparelho a cada 30 min, faixa de 0 a 360 min, hora do servidor, sem edição |
| Banco de dados e tempo real | Firestore | Coleções `unidades`, `checkins`, `alertas`, `sugestoesQuadro` |
| Identidade | Authentication anônima | Um `uid` por aparelho, sem nome, telefone ou e-mail (LGPD) |
| Importação da base oficial | `scripts/sync-pbh.ts` no GitHub Actions | Único processo fora do navegador |
| Acesso a dados pelo site | `src/services/` | A tela nunca fala direto com o Firestore. A mesma interface tem uma versão mock e uma Firestore |

Se for preciso um servidor (sorteio da disciplina, parceria com a prefeitura, abuso real), o caminho registrado é uma API Nest.js fina em `/api/v1` que reaproveita `packages/shared` (ADR-013). As telas não mudam: muda só a implementação em `src/services/`.

As decisões completas, com alternativas e consequências, estão no documento de arquitetura (ADR-000 a ADR-013).

## Estrutura de pastas

```
espera-zero/
├─ src/                    # front-end: site React (SPA)
│  ├─ pages/               # uma tela por rota: Home, Triagem, Upas
│  ├─ components/          # CartaoUpa, MapaUpas, SeletorBairro, QualUpa…
│  ├─ hooks/               # useBairro, useGeolocalizacao, usePainel, checkin/
│  ├─ services/            # acesso a dados: servicos.ts (interface), mock.ts, firestore.ts
│  └─ lib/                 # adaptadores entre as telas e packages/shared
├─ packages/shared/        # regras de negócio e tipos (contrato entre as frentes)
│  ├─ src/                 # tipos.ts, triagem.ts, espera.ts, recomendacao.ts, localizacao.ts
│  ├─ data/                # 9 UPAs e centros dos 493 bairros
│  └─ tests/
├─ scripts/                # sync-pbh.ts (base da PBH), semear.ts (dados iniciais)
├─ tests/                  # testes das Security Rules (rodam no emulador)
├─ firestore.rules         # validação de escrita
├─ firestore.indexes.json  # índices compostos
├─ firebase.json           # Hosting, rewrite da SPA e emuladores
└─ .github/workflows/      # ci.yml (lint, testes, regras, build) e sync-pbh.yml (diário)
```

## Tecnologias

React 19 · TypeScript · Vite · React Router · Firebase (Hosting, Firestore, Authentication anônima) · Leaflet + OpenStreetMap · Vitest + Testing Library · Firebase Emulator Suite · GitHub Actions.

## Como rodar

Requisitos: Node.js 24, npm e Git. Para os emuladores do Firebase, Java 21.

```bash
git clone https://github.com/ricardojunio012-a11y/espera-zero.git
cd espera-zero
npm install
npm run dev
```

Sem nenhuma configuração, o site roda com **dados simulados** (`VITE_DATA_SOURCE=mock`), sem rede, e avisa na tela que os números são simulados. Para trocar a fonte de dados, copie `.env.example` para `.env.local`.

### Com o Firebase local (emuladores)

```bash
npm run emuladores      # Firestore e Auth em localhost
npm run dev:emulador    # site apontando para os emuladores
```

A interface dos emuladores fica em http://localhost:4000.

## Testes e verificações

| Comando | O que faz |
|---|---|
| `npm run lint` | ESLint |
| `npm run test` | Testes de unidade e de tela (Vitest + jsdom), incluindo `packages/shared` |
| `npm run test:regras` | Sobe os emuladores e testa as Security Rules (precisa de Java) |
| `npm run build` | Checagem de tipos (`tsc -b`) e build de produção em `dist/` |

O CI (`.github/workflows/ci.yml`) roda os quatro em todo pull request.

## Publicação

```bash
npx firebase login
npm run deploy          # build + Hosting + regras e índices do Firestore
```

Dados iniciais em produção (precisa de uma credencial de serviço do projeto em `GOOGLE_APPLICATION_CREDENTIALS`):

```bash
npm run semear -- --unidades --agenda
```

## Como contribuir

- Uma branch por tarefa, com o id do plano: `feat/t17-modelo-firestore`.
- Nada entra na `main` sem pull request revisado por outra frente.
- Mudança em `packages/shared/src/tipos.ts` vai em PR com o rótulo `contrato`.

## Equipe

| Frente | Responsável |
|---|---|
| Gestão e produto | Ricardo |
| UX, UI e acessibilidade | Pedro Leão |
| Front-end A: início, triagem, lista e recomendação | Victor Dias |
| Front-end B: UPA, check-in, quadro e avisos | Miguel Figueiredo |
| Dados e regras | Davi Oliveira |
| Integrações e DevOps | Caio Araújo |
| Qualidade, documentação e pitch | Eder Resende |
