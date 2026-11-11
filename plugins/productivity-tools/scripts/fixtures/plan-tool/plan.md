# Plano E1 -- Walking skeleton

Plano de exemplo no formato `plan/1`: a prosa é livre e cada tarefa tem uma seção com o título fixo; o bloco de dados no fim é o contrato conferido pela ferramenta.

## Tarefas

### Tarefa 1: Armazenamento local de itens

Escrever o teste de `saveItem` e `loadItem`, ver falhar, implementar o arquivo JSON por item, ver passar.

### Tarefa 2: Rejeitar item vazio

Escrever o teste do item vazio, ver falhar, rejeitar antes de chamar `saveItem`, ver passar.

### Tarefa 3: Mostrar o item salvo

Escrever o teste da visão, ver falhar, ler o item com `loadItem` e formatá-lo, ver passar. Usa a trava `fixture-db`.

### Tarefa 4: Recarregar e mostrar o mesmo item

Escrever o teste de recarga, ver falhar, recarregar com `loadItem` e mostrar o mesmo item, ver passar. Usa a trava `fixture-db`.

### Tarefa 5: Gravar o item no backend real

Escrever o script com modo `--dry-run`; consultar o id no backend antes de gravar. A gravação real é um efeito externo e só roda autorizada.

### Tarefa 6: Documentar o armazenamento

Descrever no README o formato do arquivo e as duas funções.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E1",
  "title": "Walking skeleton",
  "spec": "../spec-tool/spec.md",
  "roadmap": "docs/plans/roadmap-exemplo/",
  "constraints": [
    "Não editar a pasta do roadmap.",
    "Cada tarefa termina com os testes dela passando."
  ],
  "tasks": [
    {
      "writes": [
        "data/"
      ],
      "produces": [
        "saveItem(item) -> id",
        "loadItem(id) -> item"
      ],
      "consumes": [],
      "covers": [
        "AC1"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "n": 1,
      "title": "Armazenamento local de itens",
      "deps": [],
      "files": {
        "create": [
          "src/store.mjs"
        ],
        "modify": [],
        "test": [
          "tests/store.test.mjs"
        ]
      },
      "score": {
        "ambiguity": 1,
        "reasoning": 1,
        "blast": 1,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test tests/store.test.mjs",
          "expect": "exit 0"
        }
      ]
    },
    {
      "writes": [],
      "produces": [],
      "consumes": [
        {
          "task": 1,
          "sig": "saveItem(item) -> id"
        }
      ],
      "covers": [
        "C1"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "n": 2,
      "title": "Rejeitar item vazio",
      "deps": [
        1
      ],
      "files": {
        "create": [
          "src/validate.mjs"
        ],
        "modify": [],
        "test": [
          "tests/validate.test.mjs"
        ]
      },
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 0,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test tests/validate.test.mjs",
          "expect": "exit 0"
        }
      ]
    },
    {
      "writes": [],
      "produces": [],
      "consumes": [
        {
          "task": 1,
          "sig": "loadItem(id) -> item"
        }
      ],
      "covers": [
        "AC1"
      ],
      "testFirst": true,
      "locks": [
        "fixture-db"
      ],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "n": 3,
      "title": "Mostrar o item salvo",
      "deps": [
        1
      ],
      "files": {
        "create": [
          "src/view.mjs"
        ],
        "modify": [],
        "test": [
          "tests/view.test.mjs"
        ]
      },
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 0,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test tests/view.test.mjs",
          "expect": "exit 0"
        }
      ]
    },
    {
      "writes": [],
      "produces": [],
      "consumes": [
        {
          "task": 1,
          "sig": "loadItem(id) -> item"
        }
      ],
      "covers": [
        "AC3"
      ],
      "testFirst": true,
      "locks": [
        "fixture-db"
      ],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "n": 4,
      "title": "Recarregar e mostrar o mesmo item",
      "deps": [
        1
      ],
      "files": {
        "create": [
          "src/reload.mjs"
        ],
        "modify": [],
        "test": [
          "tests/reload.test.mjs"
        ]
      },
      "score": {
        "ambiguity": 0,
        "reasoning": 1,
        "blast": 0,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test tests/reload.test.mjs",
          "expect": "exit 0"
        }
      ]
    },
    {
      "writes": [],
      "produces": [],
      "consumes": [
        {
          "task": 1,
          "sig": "loadItem(id) -> item"
        }
      ],
      "covers": [
        "X1"
      ],
      "testFirst": true,
      "locks": [],
      "external": true,
      "externalDedupe": "consulta o id no backend antes de gravar; se existe, não grava",
      "noCommit": false,
      "n": 5,
      "title": "Gravar o item no backend real",
      "deps": [
        1
      ],
      "files": {
        "create": [
          "scripts/sync-backend.mjs"
        ],
        "modify": [],
        "test": []
      },
      "score": {
        "ambiguity": 1,
        "reasoning": 1,
        "blast": 1,
        "verifiability": 1
      },
      "checks": [
        {
          "cmd": "node scripts/sync-backend.mjs --dry-run",
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
      "n": 6,
      "title": "Documentar o armazenamento",
      "deps": [
        2,
        3,
        4,
        5
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
      "command": "node --test tests/e1.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "blocked",
      "command": null,
      "external": false,
      "externalDedupe": null,
      "blq": "BLQ-1"
    },
    {
      "ac": "AC3",
      "kind": "test",
      "command": "node --test tests/reload.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como o plano de exemplo divide o trabalho?",
      "decision": "Uma tarefa por módulo, com a gravação no backend isolada numa tarefa externa.",
      "basis": "Cada módulo tem um critério de aceite próprio e o efeito externo precisa de dedupe.",
      "alternative": "Uma tarefa única para o armazenamento inteiro.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
