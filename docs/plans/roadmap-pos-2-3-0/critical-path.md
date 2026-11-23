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

Caminho crítico: E34 -> E35 -> E39 -> E40. Próximo marco por trilha: engineering -> E36 e E37 (E34 e E38 publicados na 2.4.0); release -> E40 com alvo de versão a redefinir na estratégia v1.1; measurement -> lote pago de confirmação de E35 (AC2), seguido de E39.
