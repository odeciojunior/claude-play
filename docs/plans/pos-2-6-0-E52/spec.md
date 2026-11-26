# Spec E52 -- Caminho agy: pwsh, docs, ferramentas e extrator

## Intenção

O E52 atende a REQ-020, REQ-021, REQ-022 e REQ-023 (issues #9, #11, #14 e #12). São as tarefas G1 e G2 do bloco G de `docs/plans/2026-11-25-correcoes-issues-plan.md`, autorizadas pela DEC-008. São quatro correções pequenas do caminho Antigravity (agy):

- o `wsl-health-check` ganha uma variante que roda a partir do pwsh no Windows;
- o README do plugin ganha uma seção agy com a distribuição global e as lacunas abertas;
- os agentes despachados pelos workflows Python recebem uma nota que traduz as ferramentas do Claude Code para as do agy, e o `deep-researcher` ganha o fallback `search_web`;
- o `roadmap-release-agy.py` lê os portões de testes com o `test-extract.mjs` antes de recorrer ao flash.

A DEC-008 cobre editar esses arquivos. Ela não cobre rodar uma sessão do Antigravity, e a regra global do dono (2026-11-22) só permite o acoplamento real com pedido direto. Por isso nenhum critério e nenhuma tarefa roda o `agy`. Os critérios AC1 e AC2 são testes com `agent()` simulado. O AC3 roda o `wsl.exe` a partir do pwsh, sem o agy.

## Escopo

Dentro:

- `plugins/productivity-tools/skills/wsl-health-check/SKILL.md`: variante pwsh no passo 1 e descrição (linha 3).
- `plugins/productivity-tools/README.md`: linha do `wsl-health-check` na tabela de skills (`:26`), pré-requisitos (`:75`) e uma seção nova `## Antigravity (agy)`.
- `plugins/productivity-tools/scripts/agy-bridge.py`: a constante `AGY_TOOL_NOTE`, a função `with_tool_note(body, prompt)` e a função `run_test_extract(root, text, exit)`.
- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.py`: `call_agent` (`:213`) passa a usar `with_tool_note`, e `read_tests_gate` (`:666-679`) tenta o extrator antes do flash.
- `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator-agy.py`: `call_agent` (`:527`) passa a usar `with_tool_note`.
- `plugins/productivity-tools/skills/deep-researcher/SKILL.md`: fallback `search_web` nos passos 3 e 4 (`:15-16`).
- Testes em `plugins/productivity-tools/scripts/agy-bridge.test.mjs` e `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs`.

Fora:

- G3a (#13), G3b (#15) e G4 (#16): ficam para o roadmap próprio de paridade agy (DEC-008, DEC-019). Isso inclui documentar no README a invocação explícita do `roadmap-release` (item d do G4).
- `roadmap-release.js`, `test-extract.mjs` e `capture.mjs`: o E52 só os chama ou os lê. O item de checklist "paridade agy" da DEC-008 não se aplica, porque o `roadmap-release.js` não muda.
- Usar o `extract.format: "vitest"` para pular o flash. O portão vitest segue o caminho de reserva, como no `.js` (DEC-022, DEC-033).
- O `ignoreFailuresWhenChanged` no `.py` (parte do G3b). O E52 só manda ao flash um portão que tenha essa chave, como faz o `gateFromCapture`.
- A nota de ferramentas no `spec-writer` e no `plan-writer`, que leem o agent do disco. A limitação fica registrada no README como lacuna.
- Bump de versão (DEC-003: só no E54).

O que não fazer:

- Não rodar `agy` em nenhuma forma (`agy -p`, `agy plugin install`, `agy plugin validate`, `run_workflow`). As afirmações do README vêm das sondas relatadas nas issues #9 e #11.
- Não alterar `load_agent_body` nem nenhum `agents/*.md`. O AC7 do bridge (`agy-bridge.test.mjs:266-272`), o `agent-contracts.test.mjs` e o `independence.test.mjs` exigem o texto literal deles.
- Não trocar o comando POSIX do `wsl-health-check` para Linux e WSL. Não usar `bash` puro no pwsh, porque ele resolve para o lançador do System32 e sai com exit 127.
- Não afrouxar `validMeasure` nem tirar teste negativo (DEC-004). Os testes T6 que esperam a chamada `gates` com a saída `tests 3 pass 3` continuam como estão, porque essa saída tem formato `unknown`.
- Não subir versão e não fazer push nem tag.
- Não ir além de G1 e G2 no caminho agy. Uma necessidade que apareça fora disso volta ao dono por um subagente opus (DEC-004, DEC-021).

## Design

**AC1 (nota de ferramentas no prompt, `agents/*.md` intactos).** Em `agy-bridge.py`, a constante `AGY_TOOL_NOTE` é um texto curto em inglês, como os outros prompts, que traz só os mapeamentos da issue #14 (R3):

- `Read` com `offset`/`limit` vira `read_file` com `StartLine`/`EndLine`;
- `Write` e `Edit` viram `write_file` e `edit_file`;
- `Bash` vira `run_command`, que no Windows é pwsh, sem sintaxe POSIX como `$(...)` (rodar o comando interno antes e usar a saída literal, por exemplo `git rev-parse --absolute-git-dir`);
- `AskUserQuestion` vira `ask_question`;
- `Grep` e `Glob` viram as ferramentas de busca do host ou `run_command`;
- `WebSearch` vira `search_web`, e não há `WebFetch`;
- `agentType` e o despacho de subagentes não existem nesse host.

A nota não usa as palavras `subagent_type`, `System32` nem nomes de tier Claude entre aspas, que os testes estáticos dos workflows recusam. A função `with_tool_note(body, prompt)` devolve `body + '\n\n' + AGY_TOOL_NOTE + '\n\n' + prompt` (R1). Em `roadmap-release-agy.py:213`, `call_agent` monta `text = with_tool_note(body, prompt) if body else prompt`: só uma chamada com o corpo de um agent recebe a nota, e as chamadas sem corpo (leitor de portão, DO-NOT CHECK, docs, report) ficam iguais (R2). Em `coordinator-agy.py:527`, `text = with_tool_note(BODIES[role], prompt)`. Como a nota fica depois do corpo, `coordinator-agy.test.mjs:285` (o prompt começa pelo corpo do agent) continua valendo, e `roadmap-release-agy.test.mjs:290` (o prompt começa com `DO-NOT CHECK`) também. Em `deep-researcher/SKILL.md:15-16`, o passo 3 passa a dizer "via WebSearch (`search_web` where WebSearch is absent, as on Antigravity)". O passo 4 passa a dizer que, sem WebFetch, valem os resultados e links do `search_web`, e as fontes não lidas por inteiro ficam marcadas como não verificadas (R4). O arquivo continua ASCII e com `i/lf` no índice (`git ls-files --eol`; a cópia de trabalho é `w/crlf` por `core.autocrlf`).

Testes novos em `agy-bridge.test.mjs`:

- (a) Com Python, para cada um dos 7 `agents/*.md`, `with_tool_note(load_agent_body(root, nome), 'PROMPT')` começa pelo corpo exato, contém `AGY_TOOL_NOTE` e termina em `PROMPT`.
- (b) `AGY_TOOL_NOTE` contém `read_file`, `StartLine`, `EndLine`, `write_file`, `edit_file`, `run_command`, `pwsh` e `search_web`.
- (c) Estático: nenhum `agents/*.md` contém `read_file` nem `AGY_TOOL_NOTE`, e os dois workflows `.py` chamam `with_tool_note(` em `call_agent`. A checagem negativa cobre as duas formas de concatenação direta que existem hoje: `body + '\n\n' + prompt` (`roadmap-release-agy.py:213`) e `BODIES[role] + '\n\n' + prompt` (`coordinator-agy.py:527`).
- (d) A lista de nomes exportados do teste de carga (`:98`) ganha `with_tool_note` e `run_test_extract`.
- (e) Com Python, `run_test_extract` sobre uma raiz inexistente e sobre um texto cujo arquivo o CLI não consegue ler (raiz válida apontando para um `scripts/test-extract.mjs` ausente numa cópia temporária) devolve `None`. A listagem de `agy-extract-*` em `tempfile.gettempdir()`, tirada antes e depois da chamada, não ganha nenhuma pasta (C3).

**AC2 (falha antes dos últimos 4.000 caracteres vista sem o flash).** Em `agy-bridge.py`, `run_test_extract(root, text, exit)` grava `text` em UTF-8 num arquivo de uma pasta criada por `tempfile.mkdtemp(prefix='agy-extract-')`. A pasta fica fora do worktree, que continua limpo, como em `run_test_integrity`. A função roda `run_cli(['node', root + '/scripts/test-extract.mjs', arquivo, '--exit', str(exit)])`, apaga a pasta num `finally` e devolve o JSON lido. Ela devolve `None` quando o exit não é 0 ou o JSON é inválido (R5). Em `roadmap-release-agy.py`, `read_tests_gate(d, r)` chama primeiro `run_test_extract(ROOT, r['stdout'], r['exit'])` sobre o stdout inteiro, sem `tail_text` (R6). O extrato é usado nas mesmas condições do `gateFromCapture` (`roadmap-release.js:199`): `format != 'unknown'`, `total` inteiro, `failedNames` lista e `d` sem `ignoreFailuresWhenChanged`. Nesse caso a função devolve `{total, skipped (0 quando não for inteiro), failedNames}` sem chamar `agent()` (R7). O extrato vale mesmo quando contradiz o exit (formato conhecido com exit diferente de 0 e `failedNames: []`, ou exit 0 com nomes), como no `gateFromCapture`, que não confere o exit. Esse caso não vai ao flash: o resultado chega a `validMeasure`, o `gateCoherent` (`roadmap-release.js:243-246`) o recusa, a medida fica nula e `run_gates` devolve `nullAgent` (`roadmap-release-agy.py:735-737`) (C6). Isso muda o comportamento de hoje, de propósito. Hoje o prompt do flash exige nomes quando o exit não é 0 (`:671-672`), então o leitor inventaria nomes. Com uma base também inventada, `gateSubset` aceitaria e `gatePasses` (`roadmap-release.js:257-264`) aprovaria um portão com exit diferente de 0. Nos outros casos, que são formato `unknown`, vitest com `failedNames: null`, falha do extrator e `ignoreFailuresWhenChanged`, segue o leitor flash de hoje, com o mesmo prompt e a cauda de 4.000 caracteres de stdout e stderr. `measure_defs` (`:702`) não muda. Testes novos em `roadmap-release-agy.test.mjs`, por snippet sobre o módulo, como o `LOOP_SNIPPET` (R8). O snippet define `ROOT`, carrega o bridge e chama `read_tests_gate` com `d = {'name': 'unit', 'cmd': 'node --test', 'kind': 'tests'}` e um `r` montado. Os casos que vão ao flash rodam com `responses = {'gates': GATE_READ}` (`GATE_READ` em `:911`), porque `read_tests_gate` tenta o flash duas vezes quando a resposta não é válida (`:674-678`). Com as respostas vazias do `loopRun` (`:712`), seriam 2 chamadas e retorno `None`.

- (a) Uma saída TAP com exit 1, com `not ok 1 - early failure` no começo e mais de 4.000 caracteres de linhas `ok` depois dela, até o resumo `# tests`/`# fail 1`: `failedNames` contém o nome da falha, `total` é o do resumo e a lista de chamadas fica vazia.
- (b) Uma saída `node-spec` verde: total certo, `failedNames` vazio e nenhuma chamada.
- (c) A saída `tests 3 pass 3`: exatamente 1 chamada `gates` no flash, e o retorno é `{total: 3, skipped: 0, failedNames: []}`, os campos de `GATE_READ`.
- (d) Um resumo vitest `Tests  97 passed (97)`: exatamente 1 chamada `gates`, com o retorno do item (c).
- (e) Um `d` com `ignoreFailuresWhenChanged: true` e saída TAP: exatamente 1 chamada `gates`, com o retorno do item (c).
- (f) Uma saída TAP toda `ok` com exit 1: `failedNames == []`, `total` do resumo e nenhuma chamada (C6).

**AC3 (variante pwsh com exit 0, critério humano).** Em `wsl-health-check/SKILL.md`, o passo 1 mantém o comando POSIX para Linux e WSL. Logo abaixo vem a variante para pwsh no Windows, o comando validado na issue #9, com barras normais e a mesma regra de fallback quando `${CLAUDE_SKILL_DIR}` não se expande (usar a pasta absoluta do SKILL.md, com `/`) (R9):

`wsl -e bash -lc 'p=$(wslpath -u "$1"); exec bash "$p" --full --no-color' -- "${CLAUDE_SKILL_DIR}/scripts/health-report.sh"`

O texto diz que, no pwsh, o placeholder `${CLAUDE_SKILL_DIR}` é trocado pela pasta absoluta do skill, com `/`, antes de rodar. Copiado literalmente, `"${CLAUDE_SKILL_DIR}/..."` vira uma variável do PowerShell, que se expande para vazio sem erro, e o caminho vira `/scripts/health-report.sh`. O texto também diz para nunca chamar `bash` puro no pwsh. A descrição troca "Not for Windows-native or macOS hosts." por uma frase que aceita o Windows com WSL a partir do pwsh e recusa o Windows sem WSL e o macOS. A linha `:26` do README troca "WSL/Linux only" pela mesma ideia. A linha `:75` passa a dizer "A WSL/Linux shell, or pwsh on Windows with WSL installed, for wsl-health-check". O `SKILL.md` e o README estão com `i/lf` no índice e `w/crlf` na cópia de trabalho, e o critério é manter `i/lf` (conferir com `git ls-files --eol`).

Verificação manual do executor, sem o agy. `<WT>` é a saída de `git rev-parse --show-toplevel` no worktree do E52, com barras normais. O executor grava no seu scratchpad o arquivo `e52-ac3.ps1` com estas duas linhas, a primeira copiada da variante nova do `SKILL.md` com a pasta do skill substituída:

```
wsl -e bash -lc 'p=$(wslpath -u "$1"); exec bash "$p" --full --no-color' -- "<WT>/plugins/productivity-tools/skills/wsl-health-check/scripts/health-report.sh"
exit $LASTEXITCODE
```

Em seguida roda `pwsh -NoProfile -File "<scratchpad>/e52-ac3.ps1"` e lê o código de saída. O critério passa com exit 0 e com a linha `HEALTH SUMMARY` presente na saída, que mostra que o script rodou dentro do WSL. A distribuição padrão nesta máquina é `ubuntu`, WSL 2, com pwsh 7.6.10. Registrar no `docs/plans/roadmap-pos-2-6-0/log.md` uma linha `| <data> | E52 | AC3: wsl-health-check pela variante pwsh (pwsh <versão de $PSVersionTable.PSVersion>, WSL <distribuição padrão>) saiu com exit 0; HEALTH SUMMARY presente | <sha do HEAD do worktree> |`. Com exit diferente de 0, registrar o exit e as últimas linhas da saída, e o AC3 fica vermelho.

**README, seção `## Antigravity (agy)`** (REQ-021, issue #11, R10). A seção fica depois de `## Prerequisites`, escrita com `<version>` no lugar de número fixo, e tem quatro partes:

- (a) Registrar as skills em `~/.gemini/config/skills.json` com caminho relativo à pasta `~/.gemini/config/` (por exemplo `"vendor/productivity-tools-<version>/skills"`) ou absoluto com `/`, nunca com `~/`, que no Windows não descobre nenhuma skill.
- (b) Em `agy -p`, passar `--add-dir "<pasta do plugin>"` quando o plugin estiver fora do workspace, porque o `spec-writer` e o `plan-writer` leem `agents/*.md` do disco (`spec-writer/SKILL.md:17`, `plan-writer/SKILL.md:28,38`).
- (c) Avisar que o `agy plugin validate` reprova os `agents/*.md` no formato do Claude Code, embora o `agy plugin install` exponha as skills.
- (d) Listar as lacunas abertas: CAPTURE e review-package nos workflows agy (#13), testes removidos declarados e pisos no `roadmap-release-agy.py` (#15), pacote nativo do agy (#16), e o `spec-writer` e o `plan-writer` sem a nota de ferramentas.

A verificação das peças de texto é o G2 (lint), `claude plugin validate plugins/productivity-tools`, o `independence.test.mjs` e o AC3, sem teste novo de texto (R11).

**Portões.** G1 com exit 0 e fail 0. O total deve ficar acima do piso atual (tests 2636, pass 2634, skipped 2, merge do E50 em 857624a) somado aos testes novos, e skipped continua 2. G2 sem FAIL. G5 não se aplica, porque `lib/` não muda.

## Deixado para o plano

- O texto exato de `AGY_TOOL_NOTE` (cerca de 600 caracteres no máximo), da variante pwsh, da descrição do `wsl-health-check`, do fallback do `deep-researcher` e da seção agy do README.
- Os nomes dos testes novos e a posição deles nos dois arquivos de teste, e se o snippet do AC2 reaproveita o `LOOP_SNIPPET` ou ganha um próprio.
- A divisão em tarefas. São 8 arquivos, e a política global pede no máximo 4 por tarefa: por exemplo, nota e fallback (bridge, dois workflows, deep-researcher, teste do bridge), extrator (bridge, roadmap-release-agy e seu teste) e textos com o AC3 (SKILL.md e README).
- Como gravar a linha do AC3 no `log.md`: pelo CLI do roadmap-tracker ou pela edição da tabela.

```json data
{
  "schema": "spec/1",
  "id": "E52",
  "title": "Caminho agy: pwsh, docs, ferramentas e extrator",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado o agy chamando um agente, quando o prompt é montado, então leva a nota de ferramentas e os agents/*.md ficam intactos. {verify: test; evidence: node --test plugins/productivity-tools/scripts/agy-bridge.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dada uma saída TAP com falha antes dos últimos 4.000 caracteres, quando o caminho agy mede o portão, então a falha é vista sem chamar o flash. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Dado um pwsh com WSL, quando o wsl-health-check roda pela variante nova, então sai com código 0. {verify: human; evidence: executor, execução manual no pwsh registrada no log}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Onde a nota de ferramentas do agy entra no prompt?",
      "decision": "Uma constante AGY_TOOL_NOTE e uma função with_tool_note(body, prompt) em agy-bridge.py, usadas pelo call_agent dos dois workflows Python; load_agent_body não muda.",
      "basis": "O AC7 do bridge (agy-bridge.test.mjs:266-272) exige o corpo exato de load_agent_body, e o plano G1 (#14) manda anexar a nota em call_agent. O bridge já é carregado pelos dois workflows, então a nota tem uma fonte só.",
      "alternative": "Anexar a nota dentro de load_agent_body, como sugere a issue #14 (quebra o AC7).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Toda chamada de agent() recebe a nota, ou só as que levam o corpo de um agent?",
      "decision": "Só as chamadas com corpo de agent, com a nota entre o corpo e o prompt; as chamadas sem corpo ficam iguais.",
      "basis": "A #14 trata das ferramentas citadas nos agents/*.md; os prompts sem corpo (leitor de portão, DO-NOT CHECK) dizem que não usam ferramentas. Os testes ancoram o começo do prompt no corpo (coordinator-agy.test.mjs:285) e em DO-NOT CHECK (roadmap-release-agy.test.mjs:290).",
      "alternative": "Pôr a nota em toda chamada de agent(), com ou sem corpo.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Quais nomes de ferramentas do agy a nota cita?",
      "decision": "Só os da issue #14: read_file com StartLine/EndLine, write_file, edit_file, run_command em pwsh sem $(...), ask_question e search_web sem WebFetch; Grep e Glob apontam para as ferramentas de busca do host ou run_command, sem nome inventado.",
      "basis": "A issue #14 é a fonte medida no agy 1.5.16; não há fonte no repositório para outros nomes, e o E52 não pode rodar o agy para conferir.",
      "alternative": "Citar nomes de ferramentas de busca do agy que não aparecem em nenhuma fonte.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Qual o fallback do deep-researcher sem WebFetch?",
      "decision": "Usar search_web no lugar de WebSearch e, sem WebFetch, usar os resultados e links do search_web, com as fontes não lidas por inteiro marcadas como não verificadas.",
      "basis": "A #14 diz que o agy tem search_web e não tem WebFetch nativo; marcar a fonte não lida mantém a regra de verificação do skill.",
      "alternative": "Mandar baixar as páginas por run_command (curl ou Invoke-WebRequest), o que abre comandos de rede no shell.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Como o caminho agy chama o extrator?",
      "decision": "Uma função run_test_extract(root, text, exit) em agy-bridge.py grava o texto num arquivo de uma pasta temporária fora do worktree, roda node scripts/test-extract.mjs <arquivo> --exit N por run_cli, apaga a pasta e devolve o JSON, ou None numa falha.",
      "basis": "O CLI do test-extract.mjs lê arquivo e run_cli só passa stdin (plano G2). O bridge já importa tempfile e segue o mesmo padrão em run_test_integrity, e a função fica testável pelo harness do bridge.",
      "alternative": "capture.mjs run --tests, que roda o comando de novo e traz o fluxo de nonce e linha assinada (parte do G3a).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Qual texto vai ao extrator: stdout ou stdout com stderr?",
      "decision": "O stdout inteiro, sem corte; o leitor flash de reserva continua com a cauda de 4.000 caracteres de stdout e stderr.",
      "basis": "É o que o capture.mjs --tests passa ao extrator no caminho .js (buildLine recebe o stdout); o node:test escreve TAP e spec no stdout.",
      "alternative": "Juntar stdout e stderr antes de extrair.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Quando o extrato substitui o flash?",
      "decision": "Nas condições do gateFromCapture: format diferente de unknown, total inteiro, failedNames lista e o portão sem ignoreFailuresWhenChanged, mesmo quando o extrato contradiz o exit (esse caso não vai ao flash; o gateCoherent anula a medida). Vitest (failedNames null), unknown, falha do extrator e ignoreFailuresWhenChanged seguem para o flash.",
      "basis": "roadmap-release.js:199 usa essas condições sem conferir o exit, e a DEC-022 manda o portão vitest pelo caminho de reserva; a issue #12 pede o flash só como reserva nesses casos. Mandar o extrato incoerente ao flash faria o prompt (roadmap-release-agy.py:671-672) inventar nomes, e com base também inventada gatePasses (roadmap-release.js:257-264) aprovaria um portão com exit diferente de 0; a medida nula (nullAgent, :735-737) é o resultado seguro.",
      "alternative": "Usar o extrato sempre que o formato for conhecido, inclusive vitest com o total do extrator e sem nomes.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Como o AC2 é testado?",
      "decision": "Por snippet sobre o módulo, como o LOOP_SNIPPET, chamando read_tests_gate (a unidade que measure_defs chama para cada portão de testes) com saídas montadas e conferindo a lista de chamadas de agent().",
      "basis": "Isola a decisão extrator ou flash sem montar um repositório e um modo run inteiros; o driver do teste já tem o mecanismo de snippet.",
      "alternative": "Um teste do modo run inteiro com um portão que imprime TAP longo.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Como a variante pwsh entra no wsl-health-check?",
      "decision": "Como segundo comando no passo 1, só para pwsh no Windows, com o comando wsl -e bash -lc validado na issue #9, barras normais e o placeholder CLAUDE_SKILL_DIR trocado pela pasta absoluta do skill antes de rodar (no pwsh ele seria uma variável vazia); o comando POSIX continua para Linux e WSL, e o texto proíbe bash puro no pwsh.",
      "basis": "A issue #9 mediu exit 127 com bash (System32) no pwsh e exit 0 com wsl -e bash -lc e wslpath -u; o plano G1 manda manter o comando POSIX.",
      "alternative": "Trocar o comando para wsl -e em todos os hosts.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "O que entra na seção agy do README?",
      "decision": "skills.json sem ~/, --add-dir em agy -p, o aviso do agy plugin validate e a lista de lacunas abertas (#13, #15, #16 e o spec-writer e o plan-writer sem a nota), com <version> no lugar de número fixo; a invocação explícita do roadmap-release (item d do G4) fica fora.",
      "basis": "Plano G1 (#11) e DEC-008, que pede as lacunas abertas na seção agy e deixa o G4 para o roadmap de paridade.",
      "alternative": "Incluir já a documentação do item d do G4.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R11",
      "question": "As mudanças de texto (SKILL.md e README) ganham teste próprio?",
      "decision": "Não. Elas são verificadas pelo G2, por claude plugin validate, pelo independence.test.mjs e pelo AC3.",
      "basis": "O plano G1 lista essas verificações para #9 e #11, e o card tem só os três critérios; um teste de texto fixaria a redação sem medir comportamento.",
      "alternative": "Asserções de texto em independence.test.mjs para a variante pwsh e a seção agy.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [],
  "externalEffects": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Saída TAP com exit 1, com not ok no começo e mais de 4.000 caracteres de linhas ok depois, até o resumo.",
      "expected": "failedNames traz a falha, total vem do resumo e nenhuma chamada de agent() acontece."
    },
    {
      "id": "C2",
      "input": "Saída de formato unknown, como 'tests 3 pass 3', ou resumo vitest 'Tests  97 passed (97)'.",
      "expected": "O leitor flash roda como hoje (no vitest porque failedNames é null, DEC-022); os testes T6 que esperam a chamada gates continuam verdes."
    },
    {
      "id": "C3",
      "input": "O extrator falha (node ausente, exit diferente de 0 ou JSON inválido), ou o portão tem ignoreFailuresWhenChanged.",
      "expected": "O portão vai ao flash, como no gateFromCapture; numa falha do extrator, run_test_extract devolve None e a pasta temporária é apagada."
    },
    {
      "id": "C4",
      "input": "pwsh no Windows, onde ${CLAUDE_SKILL_DIR} não se expande (agy) ou seria lido como variável vazia do PowerShell; e, no caminho agy, uma chamada de agent() sem corpo de agent.",
      "expected": "A variante roda com a pasta absoluta do skill no lugar do placeholder, com barras normais, sempre por wsl -e e nunca por bash puro; a chamada sem corpo fica com o prompt de hoje, sem a nota."
    },
    {
      "id": "C6",
      "input": "Extrato de formato conhecido que contradiz o exit: TAP todo ok com exit 1 (failedNames []), ou exit 0 com nomes.",
      "expected": "O extrato vale como no gateFromCapture e não vai ao flash; o gateCoherent recusa o resultado, a medida fica nula e run_gates devolve nullAgent."
    }
  ]
}
```
