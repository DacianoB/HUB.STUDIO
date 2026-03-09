# _nodes

Núcleo do sistema de nodes carregados pelo `dynamic-grid`.

## Estrutura alvo

- `/_nodes` contém config e arquivos principais do runtime
- `/_nodes/<node-name>/` contém cada node com:
  - `node.tsx`
  - `node.json`
  - `node.md`

## Pipeline de criação

Use o template em `/_nodes/templates/node-template/` para criar novos nodes rapidamente.
