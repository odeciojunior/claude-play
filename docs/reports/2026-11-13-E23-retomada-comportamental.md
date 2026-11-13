# E23: teste comportamental da retomada do release

Data: 2026-11-13. Commit sob teste: `c027235` (ponta de `release/roadmap-skills-v2`), carregado do worktree `D:/projects/claude-play-wt/_integracao`.
Execução do orquestrador da sessão principal por delegação do dono (DEC-204, DEC-617 emendada por DEC-625), no formato do relatório de E21. É registro de evidência, não registra aceite.

## Veredito

| fase / critério | veredito | motivo |
|---|---|---|
| P1 `run.json` igual ao esperado; `prep` igual à carga | **APROVADO** | Nas duas aprovações (`8658e35` spec,plan e `4d435d1` final), `run.json` é igual ao esperado calculado de forma independente. O `prep` (1.376 caracteres; 2.225 na carga codificada, com apóstrofo, `%`, `&`, `$`, `\`, aspas e acentos) é idêntico ao enviado. |
| P2 cada aprovação: um commit só com `run.json` | **APROVADO** | Um commit por aprovação, só `docs/plans/fx-E1/run.json`, com o trailer. O log de revisões saiu em commit próprio e posterior (`354ce08`, só `reviews.md`). Nenhum outro arquivo rastreado mudou, as árvores ficaram limpas e as outras branches não se moveram. |
| P3 fase 2: pulo de spec, plano e final | **APROVADO (2ª tentativa no setup)** | Na 1ª, o haiku transcreveu o `record` (1.993 caracteres) com uma `}` a mais. O JSON fica inválido, então não há pulo: falha só de proveito, sem risco. Na repetição: spec, plano e final verdadeiros. O sync pulou o final na 1ª tentativa. |
| P4 sem registro não pula; com o alvo adiante final falso, spec e plano verdadeiros | **APROVADO (2ª tentativa no sync da fase 3)** | Fase 1: tudo falso. Fase 3: final falso (alvo e árvore mudaram), spec e plano verdadeiros. Na 1ª tentativa da fase 3 o `record` voltou vazio: nada pulado, sem risco. |
| P5 fase 2: medição registrada aceita igual, gates não rodam, instalação roda | **REPROVADO, INSEGURO** | Nas duas tentativas o agente devolveu prosa em `recorded` e a cópia da medição em `baseline`, e não rodou a instalação. O workflow descartaria `recorded` e ficaria com a cópia do agente sem verificação. Na 1ª tentativa essa cópia difere da registrada (`log` truncado em 256 caracteres) e seria aceita sem nenhum gate medido. |
| P5 fase 3: gates medidos | **APROVADO** | `baseline` saiu com código 1 sem saída. A instalação e os 5 gates rodaram uma vez cada, e a medição é válida para `99acc86`. |

Portão do dono: **falha insegura em P5**. O E24 não começa até a correção (DEC-625).

## Método

- Uma sessão `claude -p` por estágio, com a fixture como diretório corrente:
  `env -u CLAUDE_CONFIG_DIR CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 claude -p "<prompt>" --plugin-dir D:/projects/claude-play-wt/_integracao/plugins/productivity-tools --model <tier> --effort <tier> --permission-mode bypassPermissions --strict-mcp-config --max-budget-usd 1 --output-format stream-json --verbose < /dev/null`.
  Claude Code 2.1.323. Cada sessão rodou direto no tier do estágio: setup e progresso em haiku/low; sync, log e preflight em sonnet/medium. Os modelos das mensagens conferem (`claude-haiku-5-5` e `claude-sonnet-5-5`), e o `init` mostra `productivity-tools` carregado do `_integracao`.
- **Prompts literais.** `bin/capture.mjs` roda o `roadmap-release.js` real no arnês de `flow.test.mjs` com um agente gravador e grava o prompt do rótulo-alvo (`prompts/<estágio>.literal.txt`). Os estágios anteriores são respondidos com o JSON real das sessões já rodadas (`state/*.json`). O arnês (`harness/flow-harness.mjs`) é o `flow.test.mjs` sem mudança, com quatro exceções: `test` é um no-op; os imports e o `import.meta.url` apontam para o arquivo original; a releitura do estágio de registro devolve a ponta real do alvo; a carga do plano usa a pasta de roadmap da fixture.
- **Pedido do arnês.** Nos estágios com schema, um bloco "HARNESS" no fim pede só o JSON do schema capturado; no workflow, o runtime impõe esse schema. O log de revisões não tem schema e foi sem esse bloco.
- **Fixture sintética.** `D:/claude-release-runs/E23-T8/fixture`, repositório git próprio com `SYNTHETIC FIXTURE` no README, no spec, no plano e no código. Alvo `release/fx` em `a877cd5`; `feat/E1` com spec e plano de uma tarefa; worktree de integração em `wt/_integracao`; pasta do entregável `docs/plans/fx-E1/`.
- **Contadores.** Os 5 gates e a instalação são `node bin/counter.mjs`; cada chamada grava uma linha em `D:/claude-release-runs/E23-T8/counters.log`, fora do repositório.
- **Passos por script, fora de sessão:** o preflight da fase 1 (medição real dos 5 gates, sem contar nos contadores), o commit da tarefa 1 (`ad5cf19`) e o avanço do alvo na fase 3 (`99acc86`).
- **Conferência.** `bin/check.mjs` confere cada critério no git e no JSON devolvido, com as funções puras reais (`runKey`, `skipReview`, `recordedBaseline`, `validMeasure`, `fnv1a`, `canon`) carregadas por `loadPure()`. Antes e depois de cada sessão há um retrato do git e dos contadores (`results/*.snap-*.json`).

## Resultados por fase

### Fase 1, sem registro

- `p1-setup` (haiku): criou `wt/E1` e rodou a instalação; `record` com `recorded: null` e spec, plano e árvore iguais aos do git; `skipReview` falso para os três (P4).
- `p1-progress` (haiku): rodou o `approve ... spec,plan` literal e gerou `8658e35` `E1: run record (spec,plan)`, só com `run.json`; `prep` igual ao da carga (P1, P2). Usou uma linha composta (o `approve` seguido de `; echo …; cd … && git …`): o prompt de progresso não traz a regra de um comando simples por chamada.
- `p1-sync` (sonnet): nada a fazer; `targetTip` `a877cd5`; `skipReview` spec e plano verdadeiros, final falso (P4).
- `p1-reviewlog` (sonnet): rodou o `approve ... final` literal e gerou `4d435d1` `E1: run record (final)`, só `run.json`; depois commitou `reviews.md` (`354ce08`). O `run.json` final mantém spec e plano e o `prep` é igual ao da carga (P1, P2).

### Fase 2, nada mudou

- `p2-setup` (haiku), 1ª tentativa: o `record` copiado com uma `}` a mais não parseia; nenhum pulo, sem risco. `p2-setup-r2`: `record` correto; spec, plano e final verdadeiros (P3).
- `p2-sync` (sonnet): nada a fazer; final, spec e plano verdadeiros (P3).
- `p2-preflight` (sonnet), 1ª tentativa: rodou o comando `baseline` literal, que imprimiu o registro. Devolveu em `recorded` uma frase e em `baseline` a cópia da medição com o `log` truncado (faltam 256 caracteres, as linhas com apóstrofo e acentos). Não rodou a instalação nem os gates. Pelas funções reais, `recordedBaseline(recorded)` dá null e o workflow manteria a cópia do agente (linha 1609, `|| pre.baseline`), que `validMeasure` aceita: medição diferente da registrada, sem gate medido. **Inseguro.**
- `p2-preflight-r2`: mesmo comportamento, com outra frase em `recorded`; a cópia saiu igual à registrada, mas o caminho continua sem verificação e sem instalação.
- Causa provável: o passo 4 diz "return it verbatim as recorded", mas a linha `Return` do prompt lista `baseline { headSha, clean, gates }` e não cita `recorded`; o schema mostra `recorded: string` sem descrição; o teste AC3 de `flow.test.mjs` simula só a resposta ideal.

### Fase 3, alvo avançou um commit

- `p3-preflight` (sonnet): `baseline` saiu com código 1, sem saída; instalação e G1 a G5 rodaram uma vez cada; medição válida para `99acc86` (P5).
- `p3-sync` (sonnet), 1ª tentativa: fez o merge (`8cf028b`), rodou `key … run`, que saiu com código 2, e devolveu `record` vazio; nenhum pulo. `p3-sync-r2`: `record` correto; final falso, spec e plano verdadeiros (P4).

## Custo

| sessão | modelo | `total_cost_usd` |
|---|---|---|
| p1-setup | haiku | 0,0081 |
| p1-progress | haiku | 0,0064 |
| p1-sync | sonnet | 0,1354 |
| p1-reviewlog | sonnet | 0,1678 |
| p2-setup | haiku | 0,0053 |
| p2-setup-r2 | haiku | 0,0041 |
| p2-sync | sonnet | 0,0524 |
| p2-preflight | sonnet | 0,1242 |
| p2-preflight-r2 | sonnet | 0,0468 |
| p3-preflight | sonnet | 0,0691 |
| p3-sync | sonnet | 0,1145 |
| p3-sync-r2 | sonnet | 0,0517 |
| total | | 0,7859 |

Teto: US$ 6 no total e US$ 1 por sessão; 9 sessões e 3 repetições.

## Pontos em aberto

1. **Medição registrada aceita sem verificação (P5, inseguro).** Com `pre.recorded` não vazio e recusado por `recordedBaseline`, o workflow não deve usar `pre.baseline` como fallback; a linha `Return` do prompt deve citar `recorded` (a saída do comando, literal); a instalação roda nos dois casos; um caso novo em `flow.test.mjs` com `recorded` em prosa e `baseline` copiado.
2. **Instalação pulada com registro.** O DEC-623 não foi cumprido nas duas sessões do preflight da fase 2.
3. **"run after the merge".** No prompt do sync, a frase foi lida como argumento `run` do `key` nas 4 sessões de sync (código 2 no primeiro comando); três se recuperaram, uma devolveu `record` vazio.
4. **`record` longo copiado por haiku.** `key` imprime o `prep` inteiro dentro de `recorded` (cerca de 2 mil caracteres); num setup da fase 2 a cópia ficou corrompida, sem risco. Proposta: `key` deixa o `prep` fora, já que `skipReview` não o usa.
5. **Instalação do setup no diretório errado.** Nas 3 sessões de setup o haiku rodou a instalação no diretório corrente, não no worktree; o texto é anterior a E23. Com um `npm ci` real, isso tocaria o checkout da pessoa.
6. **Linha composta no progresso.** O prompt do progresso não tem a regra de um comando simples por chamada.
7. **Isolamento parcial,** como em E9 e E21: configuração real do usuário; schema pedido em texto; revisões, tarefas e gates intermediários simulados pelo arnês.
8. **Pasta mantida** em `D:/claude-release-runs/E23-T8/` para conferência.

## Correção e reexecução da fase 2 (fix/pos-E23)

Commits `76676df` e `c7b4d01` em `fix/pos-E23`, a partir de `0f9e93a`.

- **Código.** Com `pre.recorded` não vazio, `pre.baseline` passa a ser só `recordedBaseline(...)`, sem a queda para `|| pre.baseline`. Um registro recusado deixa o preflight sem baseline e o run para em `preflight:other` (incompleto). Com `recorded` vazio, vale a medição do agente, como antes.
- **Prompt.** A linha `Return` cita `recorded` (o stdout bruto do 1º comando do passo 4, literal, como string, e então sem baseline). O passo 4 diz "Install first in both cases". O texto do PREFLIGHT foi reescrito sem perder regra para caber no teto. `c7b4d01` devolve `git rev-parse` ao texto de `targetHead` (achado menor da revisão: um SHA curto recusaria um registro válido).
- **Tamanho.** `workflowChars` de 239.927 para 239.994 (teto 240.000, folga 6).
- **Testes** (`flow.test.mjs`, AC3). Dois casos novos: `recorded` em prosa com `baseline` copiado para no preflight e nada de E1 roda (com `recorded` vazio a medição do agente segue valendo); o texto da linha `Return` e do passo 4. Os dois falham no código antigo e passam no novo; os casos com registro válido continuam verdes.
- **Gates.** G1 com 1699 de 1699 aprovados, G2 e G3 aprovados, G4 com 0 erros, G5 com 53 OK, 1 WARN e 0 FAIL.
- **Revisão** opus/high de `76676df`: aprovado. Nenhum caminho aceita medição não verificada; o único caso em que um run sadio para é o agente preencher `recorded` num run medido (direção segura).
- **Reexecução** do `p2-preflight` (sonnet/medium, plugin do worktree `fix-pos-E23`), numa cópia da fixture no estado da fase 2 em `D:/claude-release-runs/E23-T8-fix/` (`release/fx` em `a877cd5`, `feat/E1` em `354ce08`; mesma gatesKey `e6afe2a5`). `recorded` saiu igual ao stdout do script e `recordedBaseline` o aceita, igual ao `prep` do `run.json`. A instalação rodou uma vez, no worktree de integração; nenhum gate rodou; nenhum commit. **P5 fase 2: APROVADO** na 1ª tentativa, por US$ 0,1471. Observação: o agente rodou a instalação numa linha composta (`cd … && node …`).

Pendentes da revisão (não bloqueiam): tipo próprio de parada para registro recusado (`preflight:recorded-invalid`), com saída para ignorar o registro; `recorded` só com espaços conta como presente.

Veredito após a correção: P1 a P5 aprovados; o portão de DEC-625 está cumprido e E24 pode começar.
