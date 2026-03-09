# Node Template

## Objetivo
Descrever a intenção do node e em quais páginas/presets ele deve ser usado.

## Contrato de props
- `gridNodeId?`: id interno do node no grid
- Outras props: descrever explicitamente aqui

## Regras de implementação
- Sempre ter estado de fallback (loading/empty/error)
- Não depender de props obrigatórias sem validar
- Manter estilo consistente com o runtime do dynamic-grid
