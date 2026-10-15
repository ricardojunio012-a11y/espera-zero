# Espera Zero

Aplicação web para ajudar a população a encontrar informações sobre as Unidades de Pronto Atendimento (UPAs) de Belo Horizonte.

## Tecnologias

- React
- TypeScript
- Vite
- React Router
- Firebase (Firestore, Authentication e Hosting)
- Vitest e Testing Library

## Requisitos

- Node.js 24 ou compatível com a versão definida no projeto
- npm
- Git

## Como executar o projeto

Clone o repositório e acesse a pasta:

```bash
git clone <URL_DO_REPOSITORIO>
cd espera-zero
```

Instale as dependências:

```bash
npm install
```

Inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

O Vite mostrará o endereço local para acessar a aplicação.

## Verificações

Executar o lint:

```bash
npm run lint
```

Executar os testes automatizados:

```bash
npm run test
```

Gerar a versão de produção:

```bash
npm run build
```

## Integração contínua

O GitHub Actions executa automaticamente o lint, os testes e o build nos eventos configurados no arquivo `.github/workflows/ci.yml`.

## Status

A estrutura inicial está em desenvolvimento. As integrações com o Firebase e as funcionalidades do sistema serão implementadas conforme o planejamento do projeto.