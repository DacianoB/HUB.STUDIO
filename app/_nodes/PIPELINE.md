# Node Pipeline

## Objetivo
Padronizar criação e registro de novos nodes para o `dynamic-grid`.

## 1) Criar pasta do node

```bash
node src/app/_nodes/pipeline/create-node.mjs node-meu-bloco
```

Isso cria:

- `src/app/_nodes/node-meu-bloco/node.tsx`
- `src/app/_nodes/node-meu-bloco/node.json`
- `src/app/_nodes/node-meu-bloco/node.md`

## 2) Implementar node

- Edite `node.tsx` com lógica real do bloco.
- Defina metadados em `node.json`.
- Documente contrato e decisões em `node.md`.

## 3) Registrar no runtime

- Em `src/app/_nodes/component-registry.tsx`, adicione:
  - chave do node (`node-meu-bloco`)
  - import dinâmico de `~/app/_nodes/node-meu-bloco/node`
- Em `src/app/_nodes/components.json`, adicione entrada do node
  com layout/tags/regras.

## 4) Usar em presets

- Em `src/app/pages.json`, use `type: "node-meu-bloco"`.

## 5) Validação

- Rodar lint nos arquivos alterados.
- Validar render no `/dynamic`.
