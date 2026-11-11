# Caminho crítico

```mermaid
graph LR
  E1 --> E15
  E14 --> E15
  E14 --> E2
  E2 --> E3
  E14 --> E3
  E3 --> E18
  E14 --> E18
  E14 --> E25
  E18 --> E25
  E3 --> E22
  E2 --> E4
  E15 --> E17
  E18 --> E17
  E14 --> E5
  E5 --> E19
  E14 --> E19
  E17 --> E19
  E2 --> E6
  E5 --> E6
  E6 --> E20
  E19 --> E20
  E3 --> E7
  E6 --> E7
  E17 --> E7
  E17 --> E8
  E18 --> E8
  E19 --> E8
  E20 --> E8
  E25 --> E8
  E7 --> E11
  E8 --> E11
  E15 --> E11
  E8 --> E26
  E15 --> E26
  E8 --> E9
  E9 --> E21
  E8 --> E23
  E21 --> E23
  E21 --> E24
  E23 --> E24
  E11 --> E16
  E15 --> E16
  E21 --> E16
  E15 --> E27
  E21 --> E27
  E2 --> E10
  E18 --> E10
  E24 --> E10
  E7 --> E12
  E9 --> E12
  E21 --> E12
  E2 --> E13
  E3 --> E13
  E7 --> E13
  E9 --> E13
  E11 --> E13
  E12 --> E13
  E16 --> E13
  E17 --> E13
  E18 --> E13
  E21 --> E13
  E23 --> E13
  E25 --> E13
  E26 --> E13
  E27 --> E13
```

A cadeia mais longa até o fechamento tem 12 entregáveis. Entregáveis em alguma cadeia desse comprimento que termina em E13: E14, E2, E3, E18, E17, E19, E20, E8, E9, E21, E23, E16, E27, E12, E13. Só ordem; não há datas (DEC-003).

Publicações, na ordem: E17 (compatível), E11 (versão de quebra), E16 e E13 (DEC-014, DEC-015). As medições de política E26 e E27 não seguram publicação (DEC-047).

Próximo portão por trilha (o estado atual está em `state.md`):

- decisions: nenhuma decisão do executor pendente (DEC-085 a DEC-087 ratificadas); as sondas de E14 e os experimentos de DEC-052 estão concluídos.
- measurement: E1 na branch de release; depois que entrar em `main`, a linha de base de E15.
- engineering: specs de E2 e E5 aprovados, depois de E14.
- release: branch de release e tag da versão atual criadas (DEC-002, DEC-036); primeira publicação em E17.
- external: nenhum.
