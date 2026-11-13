# Spec E3 -- Text utilities

Duas funções de texto: contar palavras e inverter palavras.

```json data
{
  "schema": "spec/1",
  "id": "E3",
  "title": "Text utilities",
  "mode": "unattended",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Given a text with words separated by spaces, when countWords is called, then it returns the number of words. {verify: test; evidence: node --test tests/count.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Given a text, when reverseWords is called, then the words come back in reverse order. {verify: test; evidence: node --test tests/reverse.test.mjs}"
    }
  ],
  "rulings": [],
  "needsPerson": [],
  "externalEffects": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Texto vazio.",
      "expected": "As duas funções retornam o resultado vazio (0 e a string vazia)."
    }
  ]
}
```
