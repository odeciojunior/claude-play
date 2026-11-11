# E4: execução comportamental do revisor e do fluxo do planner

- Data: 2026-11-11
- Branch: `feat/E4`, commit `fe4bd41` (tarefas 1 a 8, sincronização com `release/roadmap-skills-v2` em `0988696` e correção das saídas de erro do scaffold)
- Executada pelo orquestrador da sessão principal, conforme DEC-204 (emenda de DEC-174): o executor do workflow não tem ferramenta de subagent (BLQ-1).
- Temporários em `D:/projects/claude-play-wt/_tmp/E4/`, apagados ao final. O fluxo usou uma cópia fixa do plugin (`lib/`, `skills/roadmap-planner/`, `skills/roadmap-tracker/`) tirada de `0988696`.

| Execução | Modelo | Esforço | Acesso |
|---|---|---|---|
| Revisor com a rubrica | opus | medium | só leitura |
| Fluxo do planner | sonnet | medium | escrita só em `_tmp/E4/flow` |
| Revisão adversarial do fluxo | opus | medium | só leitura |

## 1. Revisor (critério 4)

Brief do passo 7 do SKILL: pasta do roadmap, caminho da estratégia, fontes, e o caminho de `references/review-rubric.md`, que o revisor lê e aplica. A pasta foi uma cópia de `scripts/fixtures/review-planted/` sem `expected-findings.json`. Uma execução bastou: nenhum defeito plantado ficou de fora, então a rubrica não mudou.

Saída literal (os caminhos `file` são relativos à cópia em `_tmp`):

```json
{
  "findings": [
    {"file": "_tmp/E4/review/strategy.md", "line": 8, "rule": "unsourced-number", "severity": "error", "evidence": "Ship the sample onboarding portal, which cuts onboarding time by 40%.", "fix": "Back the 40% with a SRC or DEC, or tag it ASSUMPTION or UNSOURCED with an owner and list it under Assumptions."},
    {"file": "_tmp/E4/review/requirements.md", "line": 6, "rule": "compound-requirement", "severity": "error", "evidence": "| REQ-001 | The portal lets a user sign up and also exports the user list as CSV. | functional | SRC-01 | E1 | covered |", "fix": "Split REQ-001 into one requirement for sign-up and another for the CSV export of the user list, and trace each one separately."},
    {"file": "_tmp/E4/review/strategy.md", "line": 42, "rule": "unverifiable-criterion", "severity": "error", "evidence": "1. A new user can sign up and sees the welcome page. {verify: test; evidence: node --version}", "fix": "Use a test command that runs the sign-up flow and checks for the welcome page, for example a dedicated signup test, instead of node --version."},
    {"file": "_tmp/E4/review/strategy.md", "line": 39, "rule": "untraced-claim", "severity": "error", "evidence": "Why: REQ-001, REQ-002. Users need a first entry point.", "fix": "Cite the SRC that supports \"Users need a first entry point\" or mark it ASSUMPTION."},
    {"file": "_tmp/E4/review/strategy.md", "line": 63, "rule": "other", "severity": "error", "evidence": "2 covered, 0 out of scope, 0 to clarify", "fix": "Add an E1 acceptance criterion with a verify command for the CSV export in REQ-001, or mark that part out-of-scope with a reason, so the 'covered' status is true."}
  ],
  "summary": { "error": 5, "warning": 0 }
}
```

| Defeito plantado | Arquivo | Regra | Severidade | Encontrado |
|---|---|---|---|---|
| "cuts onboarding time by 40%" | `strategy.md` | `unsourced-number` | error | sim (mesma regra e severidade) |
| REQ-001 com cadastro e exportação CSV | `requirements.md` | `compound-requirement` | error | sim (mesma regra e severidade) |
| `{verify: test; evidence: node --version}` | `strategy.md` | `unverifiable-criterion` | error | sim (mesma regra e severidade) |

Achados extras, ambos procedentes no fixture e não plantados de propósito:

- `untraced-claim` em `strategy.md:39` ("Users need a first entry point" sem fonte).
- `other` em `strategy.md:63`: a cobertura diz 2 cobertos, mas a metade CSV de REQ-001 não tem critério; consequência do defeito composto.

## 2. Fluxo do planner (regra de SRC-03)

Entrada: `fixtures/model-mid.json` copiado para `_tmp/E4/flow/docs/plans/roadmap-flow/planning-model.json`, com `git init -b main` em `_tmp/E4/flow`. O agente seguiu o SKILL sem perguntar ao usuário.

| Passo | O que aconteceu |
|---|---|
| 0 | Pasta com modelo e sem `roadmap.config.json`: retomada pelo modelo, sem a pergunta de modo (`mode: full`); `nextStep` 6 |
| 6 | `node scaffold.mjs docs/plans/roadmap-flow/planning-model.json --json`: exit 0, 0 erros, 2 avisos (`critical-no-risk` em E1 e E2); 10 arquivos gravados; 18 padrões listados em `defaulted` |
| 7.1 | `node check-roadmap.mjs` na pasta: exit 0, `0 error(s), 2 warning(s)` |
| 7.2 | Sem ferramenta de subagent no teste: revisor pulado, sem autorrevisão; o handoff diz que nenhuma revisão independente rodou e recomenda o mesmo brief numa sessão nova |
| 7.4 | Modelo mantido, porque nenhum revisor rodou (ver W6) |

O agente não leu `references/formats.md` (o scaffold derivou tudo); leu `references/model.md` inteiro. Isso confirma a exclusão de `formats.md` do contexto principal em DEC-166 e DEC-167.

### Revisão adversarial do fluxo

Veredito: **pass with issues**. O revisor rodou de novo o checker na pasta resultante (0 erros, 2 avisos, exit 0), confirmou que o checker vendorizado é idêntico à fonte e que o modelo não foi alterado, e conferiu que todo valor do modelo aparece onde o contrato manda, sem número, data, gate ou meta inventados.

Achados (todos `warning`, defeitos de texto da skill ou do contrato do modelo, não do agente):

| ID | Achado | Onde |
|---|---|---|
| W1 | `model.md` diz que o padrão de `gates` é não ter tabela; `formats.md` diz que roadmap novo sempre a escreve | `model.md:23`; `formats.md:143`, `:264` |
| W2 | `objective` como texto simples é aceito em modo completo sem critério de aceite nem definição de pronto, e sem aviso | `model.md:65`; `scaffold.mjs:689-691`, `:746` |
| W3 | `questions[]` não é renderizado; respostas sem DEC, premissa ou questão aberta se perdem quando o modelo é apagado | `model.md` §3 e §9 |
| W4 | Modo completo sem `pieces`, `dod` e `risks` nos cards, sem padrão declarado nem entrada em `defaulted` | `SKILL.md:65`; `model.md` §8 |
| W5 | `defaulted` não lista métricas, flags e premissas omitidas; o texto padrão de `now` sai metade em inglês; cabeçalhos de `state.md` e `decisions.md` em inglês num roadmap pt-BR | `model.md:11`, `:24`; `state.md:4`, `:7` |
| W6 | Sem ferramenta de subagent, o SKILL não diz se o modelo fica. Se fica e o tracker é usado antes de o planner rodar de novo, a linha "Step 6 was interrupted" regenera a pasta e descarta em silêncio as edições do tracker | `SKILL.md:75`, `:87`, `:139`, `:141`; `formats.md:28` |
| W7 | Na retomada, `releaseBranch` ausente não distingue "não" de "não perguntado" | `SKILL.md:85`; `model.md:7` |

A observação do agente de que a estratégia saiu "fora da pasta" não é defeito: o contrato sempre a põe ao lado da pasta (`../<data>-roadmap-<topic>.md`).

Correções de texto recomendadas pela revisão:

1. Sem ferramenta de subagent, manter o modelo e dizer no handoff para rodar o planner de novo numa sessão com subagents antes de usar o tracker; apagar o modelo só depois de uma rodada de revisor sem `error` ou com dispensa do usuário (`SKILL.md:87`, `:139`, `:141`, `formats.md:28`).
2. Antes de rodar o scaffold sobre uma pasta existente, conferir que `log.md` e `decisions.md` só têm as linhas do scaffold (ou que o git não mostra mudanças); senão, parar e perguntar (`SKILL.md:75`).
3. Alinhar `model.md:23` e `formats.md:143/:264` sobre a tabela de gates vazia (W1).
4. `model.md` §6: dizer se `objective` pode ser texto e, em modo completo, acusar falta de aceite e de definição de pronto (W2).
5. `model.md` §3: `questions[]` só serve à retomada; toda resposta também entra em decisões, premissas ou questões abertas (W3).
6. `model.md` §8: requisitos de modo completo para `dod` e `risks`, ou padrão declarado e listado em `defaulted` (W4).
7. `model.md` §2: padrão de premissas, omissão de métricas e flags em `defaulted`, texto de `now` por idioma (W5).

A folga do orçamento de prosa em `feat/E4` é de 45 bytes LF (constante provisória de DEC-203), o que limita acrescentar texto ao SKILL e às referências contadas sem cortar outro trecho.

Aceite do critério 4: aceito em 2026-11-11, por delegação do dono.
