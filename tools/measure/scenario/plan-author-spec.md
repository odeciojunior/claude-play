# Spec E5 -- Text utilities

Synthetic fixture for measurement. Three pure text helpers (`slugify`, `truncate`, `wordCount`) with one test file each.

```json data
{
  "schema": "spec/1",
  "id": "E5",
  "title": "Text utilities",
  "mode": "unattended",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Given text with spaces, punctuation and accented letters, when slugify is called, then lowercase ASCII words joined by single hyphens come back (slugify('Café au Lait!') is 'cafe-au-lait'). {verify: test; evidence: node --test tests/e5-slugify.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Given text longer than max, when truncate is called, then at most max characters come back, ending with '…'; text of length max or less comes back unchanged; max below 1 throws a RangeError (the card test asserts the throw only for a negative max such as -1, never for 0). {verify: test; evidence: node --test tests/e5-truncate.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Given text, when wordCount is called, then the number of whitespace-separated words comes back, and 0 for empty or blank text. {verify: test; evidence: node --test tests/e5-word-count.test.mjs}"
    }
  ],
  "rulings": [],
  "needsPerson": [],
  "externalEffects": [],
  "edgeCases": []
}
```
