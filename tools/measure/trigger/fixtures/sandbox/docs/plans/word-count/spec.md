# Spec -- Word count

Uma função que conta as palavras de um texto.

```json data
{
  "schema": "spec/1",
  "id": "E2",
  "title": "Word count",
  "mode": "unattended",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Given a text with words separated by spaces, when countWords is called, then it returns the number of words. {verify: test; evidence: node --test tests/count.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Given an empty text, when countWords is called, then it returns 0. {verify: test; evidence: node --test tests/count.test.mjs}"
    }
  ],
  "rulings": [],
  "needsPerson": [],
  "externalEffects": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Texto só com espaços e quebras de linha.",
      "expected": "A função retorna 0."
    }
  ]
}
```
