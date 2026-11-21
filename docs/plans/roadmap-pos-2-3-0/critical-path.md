# Caminho crítico

```mermaid
graph LR
  E34
  E35
  E36
  E37
  E38
  E39
  E40
  E34 --> E35
  E34 --> E36
  E34 --> E37
  E34 --> E40
  E35 --> E39
  E35 --> E40
  E36 --> E40
  E37 --> E39
  E37 --> E40
  E38 --> E39
  E38 --> E40
  E39 --> E40
```

Caminho crítico: E34 -> E35 -> E39 -> E40. Próximo gate por trilha: ver `state.md`.
