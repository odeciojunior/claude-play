# Spec E1 -- Walking skeleton

Um caminho fino de ponta a ponta: um item entra, é guardado e volta. A prosa é livre e não é conferida; o que vale é o bloco de dados abaixo.

```json data
{
  "schema": "spec/1",
  "id": "E1",
  "title": "Walking skeleton",
  "mode": "unattended",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Given an empty system, when a user submits one item, then the item is stored and shown back. {verify: test; evidence: node --test tests/e1.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Given a stored item, when the owner supplies the storage credential, then the item is read from the real backend. {verify: blocked BLQ-1; evidence: aguarda credencial do dono}"
    },
    {
      "id": "AC3",
      "text": "Given a stored item, when the user reloads, then the same item is shown."
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Qual formato usar para o arquivo de armazenamento local?",
      "decision": "Um arquivo JSON por item.",
      "basis": "É o formato mais simples que satisfaz AC1 e AC3.",
      "alternative": "Um banco SQLite embutido.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como o item é identificado na interface de armazenamento?",
      "decision": "Por um identificador opaco gerado na criação.",
      "basis": "Os módulos seguintes dependem desse contrato e não podem inferir o identificador do conteúdo.",
      "alternative": "",
      "costIfWrong": "high",
      "reversible": false,
      "scope": "contract",
      "contradicts": null
    }
  ],
  "needsPerson": [
    {
      "id": "H1",
      "kind": "credential",
      "what": "Credencial do backend de armazenamento real.",
      "why": "AC2 só pode ser verificado contra o backend real.",
      "blocking": true,
      "workaround": "",
      "blq": "BLQ-1"
    },
    {
      "id": "H2",
      "kind": "data",
      "what": "Itens de exemplo reais para a demonstração.",
      "why": "Os dados sintéticos servem aos testes, mas não à demonstração ao dono.",
      "blocking": false,
      "workaround": "Usar itens sintéticos marcados como fixture.",
      "blq": "BLQ-1"
    }
  ],
  "externalEffects": [
    {
      "id": "X1",
      "what": "Gravar um item no backend de armazenamento real.",
      "target": "backend de armazenamento (produção)"
    }
  ],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Item vazio enviado pelo usuário.",
      "expected": "O sistema rejeita o item com uma mensagem de erro e não grava nada."
    }
  ]
}
```
