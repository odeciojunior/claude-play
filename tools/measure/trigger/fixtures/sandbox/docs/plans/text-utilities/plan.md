# Plano E3 -- Text utilities

Plano no formato `plan/1`: duas funções de texto e a documentação delas.

## Tarefas

### Tarefa 1: countWords

Escrever o teste de `countWords`, ver falhar, implementar dividindo por espaço em branco, ver passar.

### Tarefa 2: reverseWords

Escrever o teste de `reverseWords`, ver falhar, implementar reaproveitando a divisão, ver passar.

### Tarefa 3: Documentar as funções

Descrever no README as duas funções com um exemplo cada.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E3",
  "title": "Text utilities",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-text-utilities/",
  "constraints": [
    "Cada tarefa termina com os testes dela passando."
  ],
  "tasks": [
    {
      "writes": [],
      "produces": [
        "countWords(text) -> number"
      ],
      "consumes": [],
      "covers": [
        "AC1",
        "C1"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "n": 1,
      "title": "countWords",
      "deps": [],
      "files": {
        "create": [
          "src/count.mjs"
        ],
        "modify": [],
        "test": [
          "tests/count.test.mjs"
        ]
      },
      "score": {
        "ambiguity": 0,
        "reasoning": 0,
        "blast": 0,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test tests/count.test.mjs",
          "expect": "exit 0"
        }
      ]
    },
    {
      "writes": [],
      "produces": [
        "reverseWords(text) -> string"
      ],
      "consumes": [],
      "covers": [
        "AC2"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "n": 2,
      "title": "reverseWords",
      "deps": [],
      "files": {
        "create": [
          "src/reverse.mjs"
        ],
        "modify": [],
        "test": [
          "tests/reverse.test.mjs"
        ]
      },
      "score": {
        "ambiguity": 0,
        "reasoning": 0,
        "blast": 0,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test tests/reverse.test.mjs",
          "expect": "exit 0"
        }
      ]
    },
    {
      "writes": [],
      "produces": [],
      "consumes": [],
      "covers": [],
      "testFirst": {
        "exempt": "só documentação"
      },
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "n": 3,
      "title": "Documentar as funções",
      "deps": [
        1,
        2
      ],
      "files": {
        "create": [],
        "modify": [
          "README.md"
        ],
        "test": []
      },
      "score": {
        "ambiguity": 0,
        "reasoning": 0,
        "blast": 0,
        "verifiability": 1
      },
      "checks": []
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test tests/count.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test tests/reverse.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [],
  "needsPerson": []
}
```
