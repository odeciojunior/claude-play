# Spec word-count

Synthetic fixture for measurement. One function `wordCount(text)` in `src/word-count.mjs`, tests in `tests/word-count.test.mjs`. No roadmap.

```json data
{
  "schema": "spec/1",
  "id": "word-count",
  "title": "Word count",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Given text, when wordCount is called, then the number of whitespace-separated words comes back. {verify: test; evidence: node --test tests/word-count.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Given empty or blank text, when wordCount is called, then 0 comes back. {verify: test; evidence: node --test tests/word-count.test.mjs}"
    }
  ],
  "rulings": [],
  "needsPerson": [],
  "externalEffects": [],
  "edgeCases": []
}
```
