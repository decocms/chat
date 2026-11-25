# Régua do projeto

A régua é o design system decocms (`@decocms/ui`, AGENTS.md regra 11) e as regras de layout de `docs/design.md`. Este arquivo só anota o que vale pra estas telas.

## Paleta

Tokens do tema: `background`, `card`, `muted`, `accent`, `foreground`, `muted-foreground`, `border`, `destructive`, `brand-purple`. Sempre sólidos.

## Superfícies

- Painel: `bg-background`, separado por `border-border`.
- Item selecionado numa lista: bloco sólido `bg-accent` (ou `bg-muted`), sem borda.
- Sombra só no que flutua (`shadow-edge`).

## Componentes

- Lista de itens pra agir (Inbox): 2 linhas por item (quem · onde · hora / prévia), ações no hover/foco/linha atual, sempre visíveis no toque (`docs/design.md` › Lists).
- Abas: texto simples, linha sólida embaixo da aberta.
- Ações de um item: no item, não na barra do topo.

## Regras locais

- Duas colunas lado a lado alinham o topo: as fileiras de abas ficam na mesma altura.
- Espaçamento lateral de 24px nos painéis.
