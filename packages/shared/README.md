# @espera-zero/shared

Lógica e tipos compartilhados do projeto Espera Zero.

## Geolocalização e asset de geometria

`src/dados.ts` carrega apenas os centros leves de `data/bairros-centros.json`. O WKT fica separado em `public/bairros-geometrias.json`. O front-end deve buscar esse asset somente depois de a pessoa aceitar compartilhar a localização e passá-lo como terceiro argumento de `bairroMaisProximo(lat, lng, geometrias)`. Não importe o asset WKT em módulos carregados no início da aplicação.

## Disponibilidade na recomendação

`recomendar(unidades, especialidade, posicao, estimativas, agendas, alertas, agora)` requer agenda por slug, alertas e data/hora atual. Sem agenda para o dia/especialidade, a unidade não é recomendada.

## Testes

Execute `npm test` e `npm run typecheck` neste pacote.
