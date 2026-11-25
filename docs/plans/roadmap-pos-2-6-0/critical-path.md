# Caminho crítico

```mermaid
graph LR
  E42
  E43
  E44
  E45
  E46
  E47
  E48
  E49
  E50
  E51
  E52
  E53
  E54
  E42 --> E43
  E43 --> E46
  E44 --> E43
  E44 --> E47
  E44 --> E52
  E45 --> E53
  E46 --> E47
  E47 --> E48
  E48 --> E49
  E49 --> E53
  E50 --> E53
  E51 --> E53
  E52 --> E53
  E53 --> E54
```

Caminho crítico: E42 -> E43 -> E46 -> E47 -> E48 -> E49 -> E53 -> E54. Próximo gate por trilha: ver `state.md`.
