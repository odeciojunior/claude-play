# Plano FX -- Duas ondas

SYNTHETIC FIXTURE: plano `plan/1` sintético, só para os testes do coordinator-workflow. Não descreve trabalho real.

Onda 1: T1 e T2, sem dependências. Onda 2: T3 depende de T1 e T4 depende de T2; T4 não commita (`noCommit`) e não tem arquivos.

## Tarefas

### Tarefa 1: Módulo a

Escrever o teste de `a`, ver falhar, implementar `src/a.mjs`, ver passar.

### Tarefa 2: Módulo b

Escrever o teste de `b`, ver falhar, implementar `src/b.mjs`, ver passar. Tem portão de revisão.

### Tarefa 3: Módulo c

Usa `a` de T1: escrever o teste de `c`, ver falhar, implementar `src/c.mjs`, ver passar.

### Tarefa 4: Conferência sem arquivos

Só conferir o resultado de T2; não escreve arquivo nem commita.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "FX",
  "title": "Duas ondas",
  "spec": "spec.md",
  "roadmap": null,
  "constraints": [
    "SYNTHETIC FIXTURE: não é um plano real."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Módulo a",
      "deps": [],
      "files": { "create": ["src/a.mjs"], "modify": [], "test": ["tests/a.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 0, "verifiability": 0 },
      "produces": ["a() -> number"],
      "consumes": [],
      "covers": ["AC1"],
      "testFirst": true,
      "checks": [{ "cmd": "node --test tests/a.test.mjs", "expect": "exit 0" }],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Módulo b",
      "deps": [],
      "files": { "create": ["src/b.mjs"], "modify": [], "test": ["tests/b.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 2 },
      "produces": ["b() -> number"],
      "consumes": [],
      "covers": [],
      "testFirst": true,
      "checks": [{ "cmd": "node --test tests/b.test.mjs", "expect": "exit 0" }],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "Módulo c",
      "deps": [1],
      "files": { "create": ["src/c.mjs"], "modify": [], "test": ["tests/c.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 0, "verifiability": 0 },
      "produces": [],
      "consumes": [{ "task": 1, "sig": "a() -> number" }],
      "covers": [],
      "testFirst": true,
      "checks": [{ "cmd": "node --test tests/c.test.mjs", "expect": "exit 0" }],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 4,
      "title": "Conferência sem arquivos",
      "deps": [2],
      "files": { "create": [], "modify": [], "test": [] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "produces": [],
      "consumes": [],
      "covers": [],
      "testFirst": { "exempt": "só conferência, sem código" },
      "checks": [],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": true
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test tests/a.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [],
  "needsPerson": []
}
```
