# E3 -- CLI de eventos do tracker: plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Objetivo:** uma CLI determinística `roadmap.mjs` que lê a pasta de roadmap e grava os eventos do tracker trocando só as linhas tocadas, sempre conferida pelo checker em memória antes de gravar.

**Arquitetura:** o parser único (`lib/roadmap-format.mjs`) ganha `parseStatusSegments`, `decisionScope` e `blockLines`; o checker regenerado passa a usar as duas primeiras. Um escritor por linhas puro (`lib/roadmap-edit.mjs`) opera sobre o texto cru pelo índice de linha do texto normalizado. A CLI (`skills/roadmap-tracker/scripts/roadmap.mjs`) importa o parser, o escritor e, do checker irmão, `loadRoadmap`, `createGitAdapter`, `checkRoadmap`, `compareVersions`; cada comando de escrita calcula os textos novos em memória e passa por uma única função de transação.

**Tecnologia:** Node >= 18 (medido: v22.17.1), ESM, sem dependências, `node:test`; git só para leitura (existência e ancestralidade de commit).

**Spec:** `docs/superpowers/specs/2026-11-11-E3-cli-eventos-tracker-design.md` (ler junto com este plano; as tabelas de comandos, garantias e códigos de lá são o contrato e não são repetidas aqui).

## Restrições globais

- Ambiente medido: Windows 11, Git Bash e PowerShell, `core.autocrlf=true` (checkouts CRLF). Os testes constroem os bytes LF/CRLF/BOM/NFD por código, nunca dependem do final de linha do checkout.
- Worktree `D:/projects/claude-play-wt/E3`, branch `feat/E3`. Nada de push, nada em `main`, nada em `D:/projects/claude-play`. Sem `git stash`, sem `git add -A`: `git add` só dos arquivos da tarefa.
- Não editar `docs/plans/roadmap-evolucao-skills/` nem `plugins/_template/`. Não subir versão de `productivity-tools` nem a linha 1 do checker (`// check-roadmap 1.5.0 format 1` fica igual; DEC-042). `formatVersion` continua 1.
- Não mudar `roadmap-tracker/SKILL.md`, `references/events.md` nem `roadmap-planner/references/formats.md` (a skill passa a chamar a CLI em E22).
- `lib/roadmap-edit.mjs` e `lib/roadmap-format.mjs` sem `import`, `require`, `process`, `Buffer` ou `crypto` (a checagem `checkPureSource` de `scripts/embed.mjs`).
- Depois de editar `lib/roadmap-format.mjs`: `node plugins/productivity-tools/scripts/embed.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs`; nunca editar a região `<embed>` do checker à mão.
- Testes só em `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`; cada caso copia `scripts/fixtures/valid/` para `fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-cli-'))` e remove no fim (`t.after`). A fixture original nunca muda (G4 depende dela). Nenhuma fixture nova no repositório.
- Repositório git dos testes: `git init -b main`, commits com `-c user.name=t -c user.email=t@t -c commit.gpgsign=false`; um commit em `main` (ancestral) e outro num branch `side` fora dela.
- Códigos de saída: 0 feito ou no-op; 1 recusa por regra sem arquivo alterado; 2 uso, leitura ou gravação. `--json` dá o mesmo código.
- Frases escritas pela CLI: `language` do config começando com `pt` em português, o resto em inglês (a fixture é `en`). Palavras de status, decisão e branch sempre de `vocab`.
- Commits: `E3 T<n>: <descrição>`, terminando com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Gates canônicos (baseline: G1 exit 0, 959 testes, nenhum falhando; G2-G5 exit 0; nenhuma falha é esperada):
  - G1: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`
  - G2: `claude plugin validate .`
  - G3: `claude plugin validate plugins/productivity-tools`
  - G4: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid`
  - G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools`
- Nenhuma tarefa precisa de navegador, de servidor (faixa de portas 5210-5219 não usada), de lock, nem tem efeito externo.

## Foco da revisão

1. Célula com `\|` escapado, crase ou parênteses aninhados (ex.: nota `(BLQ-2 (ver log))`): ler e regravar a linha não pode perder o escape nem cortar a nota; teste na Tarefa 2 (`serializeRow` ida e volta) e na Tarefa 4 (`set-status` com nota aninhada).
2. Arquivo sem terminador na última linha, ou bloco cuja linha de fechamento é a última do arquivo: inserir uma linha não pode colar duas linhas nem acrescentar terminador ao fim do arquivo; teste na Tarefa 2.
3. Pasta real em português (`language: pt-BR`), estratégia fora da pasta (`../...`), checker copiado presente: `status`, `brief` e `next-id` leem sem erro; verificação manual na Tarefa 7 e teste de `next-id` com estratégia fora da pasta na Tarefa 3.
4. Pasta fora de qualquer repositório git: comandos de leitura funcionam com aviso `no-git`; `set-status` para integrado recusa com `git-unavailable` ou `sha-not-integrated`, sai 1 e não grava; teste na Tarefa 4.
5. Opção desconhecida, comando desconhecido, pasta sem `roadmap.config.json`, valor de opção ausente (`--what` no fim da linha): sai 2 com `usage`, nada gravado; teste na Tarefa 3.

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Tarefas |
|---|---|---|
| `plugins/productivity-tools/lib/roadmap-format.mjs` | parser: ganha `parseStatusSegments`, `decisionScope`, `blockLines` | 1 |
| `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` | regenerado; `segments` local e regex de alcance trocados pelas funções do módulo | 1 |
| `plugins/productivity-tools/lib/roadmap-edit.mjs` (novo) | escritor por linhas puro | 2 |
| `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs` (novo) | CLI, comandos e transação | 3-7 |
| `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` (novo) | todos os testes do card | 1-7 |
| `.claude/rules/roadmap-checker.md` | uma linha sobre a CLI | 7 |

As tarefas são sequenciais (todas tocam `roadmap.test.mjs`); nenhuma roda em paralelo.

---

### Tarefa 1: funções novas do parser e checker regenerado

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/lib/roadmap-format.mjs`
- Modificar (regenerado + uso nas checagens): `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs`
- Criar (teste): `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`

**Interfaces:**
- Produz, exportadas de `lib/roadmap-format.mjs`:
  - `parseStatusSegments(cell: string) -> Array<{ raw: string, label: string, word: string, note: string }>`: separa por `;`, apara, descarta vazios; `note` é o texto entre os parênteses finais (sem os parênteses, `''` se não há) obtido com `stripNote`; `label` é o texto antes do primeiro `:` do segmento sem nota (`''` se não há `:`); `word` o texto depois dele, aparado.
  - `parseStatus(cell)` passa a ser `parseStatusSegments(cell).map((s) => s.word)` (mesma saída de hoje).
  - `decisionScope(cell: string) -> 'local' | 'contract'`: `'local'` só quando `/\b(?:Alcance|Scope)\s*:\s*local\s*\.?\s*$/i` casa a célula aparada.
  - `blockLines(text: string, name: string) -> { open: number, close: number, header: number|null, rows: number[], items: Array<{ start: number, end: number }> } | null`: índices de linha (base 0) em `norm(text).split('\n')` do primeiro bloco bem formado e fechado com esse nome (via `scanBlocks`); `open`/`close` são as linhas dos comentários; numa tabela, `header` é a linha de cabeçalho e `rows` as linhas de dados (pula separador como `parseTable`); numa lista, `items` dá o intervalo inclusivo de cada item com linhas de continuação (mesma regra de `parseList`). `null` se não há bloco.

- [ ] **Passo 1: escrever os testes que falham** em `roadmap.test.mjs` (importando de `../../../lib/roadmap-format.mjs`):
  - `parseStatusSegments('piece 1: integrated (`abc1234`); piece 2: spec')` → `[{ raw: 'piece 1: integrated (`abc1234`)', label: 'piece 1', word: 'integrated', note: '`abc1234`' }, { raw: 'piece 2: spec', label: 'piece 2', word: 'spec', note: '' }]`; `parseStatusSegments('blocked (BLQ-2 (see log))')[0]` tem `word: 'blocked'`, `note: 'BLQ-2 (see log)'`, `label: ''`.
  - `parseStatus` devolve as mesmas palavras que antes para as duas células acima.
  - `decisionScope('X. Alcance: local.') === 'local'`, `decisionScope('X. Scope: local') === 'local'`, `decisionScope('X. Alcance: contrato.') === 'contract'`, `decisionScope('local scope') === 'contract'`.
  - `blockLines` sobre o `state.md` da fixture montado em três variantes (LF; CRLF com BOM; LF com uma linha em NFD fora do bloco, ex. `"Cafe\u0301"` no cabeçalho): mesmo resultado nas três; para `panel`, `rows.length === 3` e a linha `rows[0]` do texto cru partido por `/\r\n|\r|\n/` começa com `| E1 |`; para `blockers`, `rows` é `[]` e `header` aponta a linha `| ID | Blocker |...`; para `pending`, `items.length === 1`; `blockLines(text, 'nope') === null`.
  - `checkPureSource` de `../../../scripts/embed.mjs` sobre o texto de `lib/roadmap-format.mjs` devolve `null`.

- [ ] **Passo 2: rodar e ver falhar**
  Rodar: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`
  Esperado: FAIL (`parseStatusSegments` não é exportada).

- [ ] **Passo 3: implementar** as três funções em `lib/roadmap-format.mjs`; reescrever `parseStatus` sobre `parseStatusSegments`.

- [ ] **Passo 4: trocar o código local do checker e regenerar.** Fora da região `<embed>` de `check-roadmap.mjs`: o `const segments = (cell) => ...` (linha ~889) passa a `const segments = parseStatusSegments;` (as checagens `status-order`, `blocked-no-blq`, `blocker-no-restore`, `executor-decision-pending` só usam `raw` e `word`, que não mudam); em `executor-decision-pending`, `const local = decisionScope(row[3]) === 'local';`. Depois: `node plugins/productivity-tools/scripts/embed.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs`. Linha 1 continua `// check-roadmap 1.5.0 format 1`.

- [ ] **Passo 5: verificar**
  - `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` → PASS.
  - `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs` → PASS sem mudança no arquivo de teste (prova que a saída não mudou e que o checker não está defasado).
  - `node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` → exit 0.
  - G4 → exit 0, 0 erros e 0 avisos. `head -1` do checker → `// check-roadmap 1.5.0 format 1`.

- [ ] **Passo 6: commit**
```bash
git add plugins/productivity-tools/lib/roadmap-format.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs
git commit -m "E3 T1: parseStatusSegments, decisionScope e blockLines no parser; checker regenerado" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 2: escritor por linhas

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Criar: `plugins/productivity-tools/lib/roadmap-edit.mjs`
- Modificar (teste): `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`

**Interfaces:**
- Consome: nada (puro, sem imports; recebe o resultado de `blockLines` como dado).
- Produz, exportadas de `lib/roadmap-edit.mjs`:
  - `splitLines(raw: string) -> { bom: string, lines: Array<{ text: string, eol: string }> }`: `bom` é `'\uFEFF'` ou `''`; `eol` é `'\r\n'`, `'\r'`, `'\n'` ou `''` (só na última linha sem terminador).
  - `joinLines(doc) -> string`: inversa exata; `joinLines(splitLines(x)) === x` para qualquer `x`.
  - `serializeRow(cells: string[]) -> string`: `| c1 | c2 | ... |`, `|` da célula escrito `\|`, `\r`/`\n` da célula trocados por espaço, texto em NFC.
  - `applyEdits(raw: string, edits: Array<Edit>) -> string`, com `Edit` = `{ op: 'replace', line: number, text: string }` | `{ op: 'insertBefore' | 'insertAfter', line: number, text: string }` | `{ op: 'remove', line: number, end?: number }` (intervalo inclusivo, para item de lista com continuação). Índices referem-se às linhas ANTES de qualquer edição; aplicar de baixo para cima. Linha nova leva o terminador da linha `line` (vizinha no bloco); se essa linha não tem terminador (fim do arquivo), a nova recebe o terminador da linha anterior e a ordem é ajustada para não colar linhas nem acrescentar terminador ao fim do arquivo. Linha trocada mantém o próprio terminador. Texto novo em NFC.
  - `touchedLines(before: string, after: string) -> { before: Set<number>, after: Set<number> }` NÃO é exportado aqui: o teste usa sua própria comparação (Passo 1).

- [ ] **Passo 1: escrever os testes que falham:**
  - `joinLines(splitLines(x)) === x` para `x` em: `'a\r\nb\r\n'`, `'\uFEFFa\nb'`, `'a\rb\r\n'`, `''`, `'só uma'`.
  - `applyEdits('\uFEFFh\r\nx\r\ny\r\n', [{ op: 'insertAfter', line: 1, text: 'n' }]) === '\uFEFFh\r\nx\r\nn\r\ny\r\n'`; o mesmo com `'h\nx\ny'` e `insertAfter` na linha 2 → `'h\nx\ny\nn'` (nenhum terminador acrescentado ao fim).
  - `replace` na linha 1 de `'a\nb\r\nc\n'` com `'B'` → `'a\nB\r\nc\n'`; linha 0 em NFD intocada continua NFD byte a byte.
  - `remove` com `{ line: 1, end: 2 }` em `'- a\n- b\n  cont\n- c\n'` → `'- a\n- c\n'`.
  - Várias edições numa chamada (replace 3, insertBefore 1, remove 5) dão o mesmo que aplicá-las uma a uma de baixo para cima.
  - `serializeRow(['a|b', 'x\r\ny', 'Cafe\u0301'])` === `'| a\\|b | x y | Café |'` (com `é` em NFC); `splitRow(serializeRow(cells))` (de `roadmap-format.mjs`) devolve `cells` normalizados (ida e volta, Foco 1).
  - `checkPureSource(texto de lib/roadmap-edit.mjs, 'roadmap-edit')` → `null`.

- [ ] **Passo 2: rodar e ver falhar** — `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` → FAIL (módulo inexistente).

- [ ] **Passo 3: implementar** `lib/roadmap-edit.mjs` com as quatro exportações acima.

- [ ] **Passo 4: verificar** — o mesmo comando → PASS; G4 → exit 0.

- [ ] **Passo 5: commit**
```bash
git add plugins/productivity-tools/lib/roadmap-edit.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs
git commit -m "E3 T2: escritor por linhas que preserva BOM, finais de linha e texto não tocado" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 3: núcleo da CLI e comandos de leitura

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Criar: `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs`
- Modificar (teste): `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`

**Interfaces:**
- Consome: `parseRoadmapTexts`, `parseStatusSegments`, `decisionScope`, `blockLines`, `norm`, `idsIn`, `shasIn` (Tarefa 1 e existentes); `loadRoadmap`, `createGitAdapter`, `checkRoadmap`, `compareVersions`, `FORMAT_VERSION`, `CHECKER_VERSION` de `./check-roadmap.mjs`.
- Produz, exportadas de `roadmap.mjs`:
  - `run(argv: string[], io?: { cwd?: string, today?: string, hooks?: { beforeWrite?: (file: string) => void } }) -> { exitCode: 0|1|2, output: object }` onde `output` tem exatamente a forma `{ tool: 'roadmap', command, folder, changed: string[], result, errors: [{ code, message }], warnings: [{ code, message }], summary: { errors, warnings, exitCode } }`. `argv` é a lista depois de `node roadmap.mjs`. Nunca chama `process.exit`; não escreve no console.
  - `formatText(output) -> string`: uma linha por arquivo alterado, `ERROR <código>: <msg>` / `WARN <código>: <msg>` por achado, última linha `roadmap <comando>: changed <n> file(s), <e> error(s), <w> warning(s)`.
  - `nextId(folder: string, strategyPath: string, kind: 'DEC'|'BLQ'|'REQ'|'SRC'|'E') -> string`: maior número desse tipo em qualquer arquivo regular da pasta (recursivo, fora `.git` e `node_modules`, inclusive cercas de código e o checker copiado) e na estratégia, mais um; largura `DEC-NNN`, `REQ-NNN`, `SRC-NN`, `BLQ-n`, `E<n>`. Regex por tipo com fronteira (`\bBLQ-(\d+)\b`, `\bE(\d+)\b` etc.).
  - `class Refusal extends Error { constructor(code, message, exitCode = 1) }` usada por todos os comandos.
  - Registro de comandos `COMMANDS: Record<string, (ctx) => void>` onde `ctx = { folder, args, opts, roadmap, git, lang: 'pt'|'en', today, result, warnings }`; as Tarefas 4-6 acrescentam entradas.
  - Main: só quando o arquivo é o processo principal (mesma checagem por `realpathSync` do checker); imprime `JSON.stringify(output, null, 2)` com `--json`, senão `formatText`; `process.exitCode = exitCode`.
- Comandos desta tarefa (saídas da spec, Peça 1): `status`, `brief`, `next-id`, `pending-decisions`, `verify-commit`, mais `--help` / `help` (lista os 18 comandos e as opções da spec; sai 0).
- Parser de argumentos: posicional `<comando> <pasta>`, opções `--nome valor` repetíveis onde a spec diz `...` (`--evidence`, `--next`), flags `--json`, `--help`. Opção desconhecida, valor ausente, comando desconhecido, pasta sem `roadmap.config.json`, JSON inválido → `usage` (ou `not-found` para a pasta), exit 2. Pasta com `formatVersion > FORMAT_VERSION` → `format-newer`, exit 1 em qualquer comando de escrita (leitura relata como erro, exit 1).
- `lang`: `config.language` começando com `pt` → `'pt'`, senão `'en'`. Data: `--date AAAA-MM-DD` validada (senão `usage`), padrão `io.today` ou a data local.
- Sem git (`createGitAdapter` devolve `null` ou `unavailable`): aviso `no-git`; `verify-commit` devolve `result: { exists: null, integrated: null, reason }`, exit 0.

- [ ] **Passo 1: helpers de teste e testes que falham.** No topo de `roadmap.test.mjs`, helpers reutilizados pelas tarefas seguintes:
  - `makeFolder(t, { eol = '\n', bom = false, nfdLine = false, git = false, mutate = {} } = {}) -> { dir, read(name), write(name, text), shas: { main, side } }`: copia `fixtures/valid/` para um temporário, regrava cada `.md` com o `eol` pedido, BOM opcional em `state.md` e, com `nfdLine`, troca o título `# State` por `# State Cafe\u0301` (fora de qualquer bloco); `mutate[name]` é uma função `(text) => text` aplicada antes; com `git`, faz `git init -b main`, commit de tudo em `main`, `git checkout -b side`, commit vazio, `git checkout main`, e devolve as duas SHAs completas.
  - `cli(dir, ...args) -> { exitCode, output }` = `run([args[0], dir, ...args.slice(1), '--json'])`.
  - `spawnCli(...args)` com `spawnSync(process.execPath, [ROADMAP, ...args])` para os testes de processo.
  Testes:
  - `status` na fixture: exit 0, `output.result.panel` com 3 linhas, `panel[0].segments[0]` = `{ label: '', word: 'spec', position: 2, note: '' }`, `changed: []`.
  - `brief`: exit 0, `result.nextIds` = `{ DEC: 'DEC-002', BLQ: 'BLQ-1', REQ: <o maior REQ da fixture + 1>, SRC: <idem>, E: <idem> }` (o teste calcula o esperado varrendo a fixture com o mesmo regex), `result.checker.errors === 0`.
  - `next-id BLQ` com `BLQ-7` escrito só num arquivo `notes/extra.txt` criado na pasta → `BLQ-8`; com `BLQ-9` só numa estratégia fora da pasta (mova `strategy.md` para o pai e ajuste `config.strategy` para `../strategy.md`) → `BLQ-10` (Foco 3).
  - `pending-decisions` com uma linha de decisão executor/pending acrescentada por `mutate` (Decisão terminando em `Scope: contract.`) → `result.decisions[0]` com `id`, `deliverable`, `scope: 'contract'`.
  - `verify-commit` com `git: true`: SHA de `main` → `{ exists: true, integrated: true }`; de `side` → `{ exists: true, integrated: false }`; `0000000` → `{ exists: false, integrated: false }`; pasta sem git → exit 0, aviso `no-git` (Foco 4).
  - Uso inválido (Foco 5): `cli(dir, 'nope')`, `cli(dir, 'status', '--bogus', 'x')`, `run(['status', <pasta vazia>])`, `run(['log', dir, '--what'])` → exit 2, erro `usage` ou `not-found`, nenhum byte da pasta alterado.
  - `spawnCli('status', dir)` → exit 0 e a última linha do stdout casa `/^roadmap status: changed 0 file\(s\), 0 error\(s\), \d+ warning\(s\)$/`; `spawnCli('status', dir, '--json')` → mesmo exit e JSON com `tool: 'roadmap'`.
  - `spawnCli('--help')` → exit 0 e o texto cita os 18 nomes de comando.

- [ ] **Passo 2: rodar e ver falhar** — `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` → FAIL (`roadmap.mjs` inexistente).

- [ ] **Passo 3: implementar** o núcleo e os cinco comandos de leitura em `roadmap.mjs`.

- [ ] **Passo 4: verificar** — o mesmo comando → PASS; G4 → exit 0.

- [ ] **Passo 5: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs
git commit -m "E3 T3: núcleo da CLI roadmap.mjs e comandos de leitura" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 4: transação de escrita, `log`, `set-status`, `integrate`

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs`
- Modificar (teste): `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`

**Interfaces:**
- Consome: `applyEdits`, `serializeRow`, `splitLines` (Tarefa 2); `blockLines`, `parseStatusSegments` (Tarefa 1); `run`, `Refusal`, `COMMANDS`, `ctx` (Tarefa 3).
- Produz (internas de `roadmap.mjs`, usadas pelas Tarefas 5 e 6):
  - `commitWrites(ctx, changes: Map<role|'checkerCopy', string>)`: implementa as cinco garantias da spec, nesta ordem: (a) `format-newer`; (b) monta o roadmap como `loadRoadmap` com os textos novos e roda `checkRoadmap` antes e depois com o mesmo adaptador git; erro novo (mesmo `code`, `file`, `message` ausente antes) → `Refusal('checker-errors')` listando os erros; aviso novo → `checker-warning` nos avisos; (c) relê cada arquivo e compara byte a byte com o lido no início do comando → `concurrent-change` (exit 1); o gancho `io.hooks.beforeWrite(file)` roda logo antes dessa releitura (só para teste); (d) grava cada arquivo em `<nome>.tmp-<pid>` na mesma pasta e renomeia, na ordem fixa `decisions.md`, `state.md`, `log.md`, checker copiado; falha no meio → erro `write-failed`, `changed` lista os já gravados, exit 2; (e) arquivo cujo texto novo é igual ao velho não é gravado nem listado (no-op = exit 0, `changed: []`).
  - `logRow(ctx, { deliverable, what, evidence, date }) -> Edit`: valida `what` (`cell-too-long` acima de `limits.cellChars`, `banned-phrase` por `vocab.bannedPhrases` sem caixa), `evidence` vazia → `evidence-missing`; evidência sem crase ganha crase; insere antes da primeira linha de dados cuja data é igual ou anterior (ou depois do separador se o log está vazio).
  - `setSegment(ctx, rowCells, { piece, word, evidence, next, note }) -> string[]` (células novas).
- Comandos (contrato na spec, Peça 2): `log`, `set-status`, `integrate`. Recusas desta tarefa: `status-backward`, `status-not-allowed`, `segment-required`, `segment-locked`, `sha-missing`, `sha-not-integrated`, `git-unavailable`, `not-found` (entregável), `cell-too-long`, `banned-phrase`, `evidence-missing`. Ref de integração: `integrationBranch` ou `origin/<integrationBranch>` pelo adaptador git.

- [ ] **Passo 1: testes que falham** (cada um compara os bytes de todos os arquivos da pasta antes e depois quando a expectativa é "nada gravado"):
  - `log --deliverable E1 --what 'Spec written' --evidence docs/spec-e1.md --date 2026-01-03` → exit 0, `changed: ['log.md']`, a nova linha é a primeira de dados e a evidência sai `` `docs/spec-e1.md` ``; com `--date 2026-01-01` a linha entra antes da linha `2026-01-01` existente; `--what 'see this commit'` → exit 1 `banned-phrase`; `--what` com 301 caracteres → `cell-too-long`; `--evidence ''` → `evidence-missing`.
  - Critério 3 (AC3): `makeFolder` com a linha E2 do painel trocada por `| E2 | piece 1: integrated (\`<sha main>\`); piece 2: spec | \`<sha main>\` | Plan piece 2 |` e `git: true`: `set-status E2 spec --piece 'piece 1'` → exit 1 `status-backward`, bytes de `state.md` idênticos; `set-status E2 plan` sem `--piece` → exit 1 `segment-required`, bytes idênticos.
  - `set-status E2 plan --piece 'piece 2' --evidence docs/plan.md` → exit 0, só a linha E2 muda, célula `piece 1: integrated (...); piece 2: plan`, evidência anterior mantida e a nova acrescentada; repetir → exit 0 `changed: []`.
  - `set-status E1 integrated --evidence <sha side>` → exit 1 `sha-not-integrated`; com `<sha main>` → exit 0; `--evidence 1234567` (inexistente) → `sha-missing`; mesmo comando numa pasta sem git → exit 1 (`git-unavailable` ou `sha-not-integrated`), nada gravado (Foco 4); `set-status E1 blocked` → `status-not-allowed`.
  - Nota aninhada (Foco 1): E1 com status `spec (draft (v2) \| wip)` passa a `plan` mantendo a nota byte a byte.
  - `integrate --sha <sha main> --date 2026-01-04` com E1 em `on-branch` citando `<sha main>` e E3 em `on-branch` citando `<sha side>` → só E1 vira `integrated` e ganha a SHA; uma linha de log citando E1; repetir → no-op sem log.
  - Garantias: `checker-errors` — `set-status E1 plan --next 'Fix it in this commit'` (o `--next` não é validado pela CLI; o checker dá erro `banned-phrase`) → exit 1 `checker-errors`, a mensagem cita `banned-phrase`, nada gravado; o mesmo com `--next` de 301 caracteres (`cell-limit`). `concurrent-change` — `run([...], { hooks: { beforeWrite: (f) => fs.appendFileSync(f, 'x') } })` → exit 1 `concurrent-change`, conteúdo é o do gancho (nada da CLI). `format-newer` — `formatVersion: 99` → exit 1, nada gravado. `--json` e texto dão o mesmo exit code para uma recusa (`spawnCli`).

- [ ] **Passo 2: rodar e ver falhar** — `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` → FAIL nos casos novos.

- [ ] **Passo 3: implementar** `commitWrites`, `logRow`, `setSegment` e os três comandos.

- [ ] **Passo 4: verificar** — o mesmo comando → PASS; G4 → exit 0; `git status --porcelain` mostra só os dois arquivos da tarefa (a fixture não mudou).

- [ ] **Passo 5: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs
git commit -m "E3 T4: transação de escrita conferida pelo checker; log, set-status e integrate" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 5: bloqueios, `prune` e `refresh-checker`

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs`
- Modificar (teste): `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`

**Interfaces:**
- Consome: `commitWrites`, `logRow`, `setSegment` (Tarefa 4); `nextId` (Tarefa 3).
- Produz: comandos `block-open`, `block-close`, `prune`, `refresh-checker` (contrato na spec, Peça 2). Frase de restauração: `pt` → `restaura E<n> para <palavra>` / `restaura E<n> (<rótulo>) para <palavra>`; `en` → `restores E<n> to <palavra>` / `restores E<n> (<label>) to <palavra>`, uma por afetado, separadas por `; `. `block-close` lê a palavra com a regra de `blocker-no-restore` (primeira palavra de `deliverableStatuses`, diferente de bloqueado, que aparece depois de `E<n>`); recusas `restore-unreadable` e `blocker-cited` (lista arquivo e linha). Checker do plugin para `refresh-checker`: `fileURLToPath(new URL('./check-roadmap.mjs', import.meta.url))`; cópia: `<pasta>/check-roadmap.mjs`; pendente `(maintainer) checker <v> available: N errors to fix` / `(mantenedor) checker <v> disponível: N erros a corrigir`.

- [ ] **Passo 1: testes que falham:**
  - `block-open --what 'Vendor API down' --affects E1 --unblocks 'vendor answers' --since 2026-01-05` → exit 0, `result.id === 'BLQ-1'`, linha nova no bloco de bloqueios terminando com `restores E1 to spec`, E1 com status `blocked (BLQ-1)`, uma linha de log; `changed` = `['state.md', 'log.md']`; checker do plugin sem erro.
  - Linha segmentada: com `--piece 'piece 2'` só esse segmento vira `blocked (BLQ-n)` e a frase é `restores E2 (piece 2) to spec`; sem `--piece` → `segment-required`.
  - Critério 2 (AC2): `block-open` (BLQ-1), depois `block-close BLQ-1 --how 'vendor answered'` → exit 0, a linha sai de `blockers`, E1 volta a `spec`, o log tem as duas linhas; então `next-id BLQ` → `BLQ-2`, e o teste confere, varrendo todos os arquivos da pasta (recursivo) e a estratégia, que o texto `BLQ-2` não aparece em nenhum; repetir com `BLQ-7` escrito antes só em `notes/extra.txt` → `next-id BLQ` devolve `BLQ-8`, também ausente de todo arquivo.
  - `block-close` com o `BLQ-1` ainda citado em `critical-path.md` → exit 1 `blocker-cited`, mensagem cita `critical-path.md`, nada gravado; com "Unblocks when" sem palavra de status → `restore-unreadable`.
  - `prune` com uma linha `| feat/x | deleted | - |` em `inflight` e um item `donot` citando só um `BLQ-3` inexistente nos bloqueios → ambos saem, sem log; repetir → `changed: []`.
  - `refresh-checker`: sem cópia na pasta → copia o checker do plugin byte a byte (compara `Buffer`s), linha de log `checker updated` citando as versões; com a cópia já igual → no-op; com cópia de linha 1 `// check-roadmap 9.9.9 format 1` → no-op. Com a pasta que faz o checker do plugin acusar erro (via `mutate`) → cópia mantida, pendente `(maintainer) checker <v> available: N errors to fix` gravado ou atualizado (sem duplicar).

- [ ] **Passo 2: rodar e ver falhar** — `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` → FAIL nos casos novos.

- [ ] **Passo 3: implementar** os quatro comandos.

- [ ] **Passo 4: verificar** — o mesmo comando → PASS; G4 → exit 0.

- [ ] **Passo 5: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs
git commit -m "E3 T5: block-open, block-close, prune e refresh-checker" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 6: acréscimo, ratificação e rejeição

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs`
- Modificar (teste): `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`

**Interfaces:**
- Consome: `commitWrites`, `logRow`, `nextId`, `decisionScope`, `serializeRow`.
- Produz: comandos `add-decision`, `add-pending`, `inflight-add`, `inflight-remove`, `ratify`, `reject` (contrato na spec, Peça 3). Frase de alcance: `pt` → `Alcance: local.` / `Alcance: contrato.`; `en` → `Scope: local.` / `Scope: contract.`; `--scope` aceita `local`, `contrato` ou `contract`. Normalização para idempotência: `norm`, colapso de espaços, sem a frase de alcance final, comparação exata. Log de `ratify`: `DEC-NNN ratified by the owner` / `DEC-NNN ratificada pelo dono`; de `reject`: `DEC-old rejected by the owner; DEC-new supersedes it` / `DEC-velho rejeitada pelo dono; DEC-novo a substitui`; evidência `` `decisions.md` ``. Alternativa descartada padrão de `reject`: `the executor's choice in DEC-NNN` / `a escolha do executor em DEC-NNN`. `add-decision` sem `--discarded` → `none stated`; `Contradicts` padrão `-`; `Revisit when` padrão `-`.

- [ ] **Passo 1: testes que falham:**
  - Critério 4 (AC4): `add-decision --deliverable E1 --decision 'Use SQLite' --scope local --date 2026-01-06` → exit 0, `result.id === 'DEC-002'`, `decisions.md` ganha uma linha com Origem `executor`, Status `pending`, Decisão terminando em `Scope: local.`, Discarded `none stated`; rodar de novo (com `'Use  SQLite'`, espaço duplo) → exit 0, `changed: []`, `result.id === 'DEC-002'`, e a contagem de linhas `DEC-002` em `decisions.md` é 1. `add-pending --owner owner --text 'Ratify DEC-002'` duas vezes → um item `- (owner) Ratify DEC-002` no fim do bloco `pending`, segunda vez `changed: []`; `--owner ''` → exit 1 `owner-missing`. `inflight-add feat/e1 --note 'E1 work'` duas vezes → uma linha `| feat/e1 | live | E1 work |` no bloco `inflight`; com a linha já `deleted` → passa a `live`; `inflight-remove feat/e1` → sai; de novo → no-op. Nenhum destes grava log.
  - Critério 5 (AC5): pasta com `DEC-002` executor/pending e o item `- (owner) Ratify DEC-002` em `pending`; `ratify DEC-002 --date 2026-01-07` → exit 0; na linha `DEC-002` só a 9ª célula difere (`in-force`), comparando célula a célula com `splitRow`; o item pendente sumiu; há exatamente uma linha de log nova citando `DEC-002`. Item `- (owner) Review DEC-002 and DEC-001` fica e gera aviso `pending-multi-cite`. `ratify DEC-001` (origem `SRC-01`) → exit 1 `not-executor`; `ratify` numa executor já `in-force` → exit 1 `not-pending`; `ratify DEC-099` → exit 1 `not-found`; nos três, bytes de todos os arquivos idênticos.
  - Critério 6 (AC6): `reject DEC-002 --decision 'Use Postgres' --date 2026-01-08` → exit 0, `result.id === 'DEC-003'`; linha `DEC-003` com entregável `E1`, Origem `user`, Status `in-force`, Contradicts `-`, Discarded `the executor's choice in DEC-002`; na linha `DEC-002` só a 9ª célula muda, para `superseded by DEC-003`; nenhuma outra linha de `decisions.md` muda; uma linha de log; checker do plugin sem erro. As mesmas recusas de `ratify`.
  - Uma pasta com `language: pt-BR` (via `mutate` do config): `add-decision --scope contrato` termina em `Alcance: contrato.`; `ratify` grava `ratificada pelo dono`.

- [ ] **Passo 2: rodar e ver falhar** — `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` → FAIL nos casos novos.

- [ ] **Passo 3: implementar** os seis comandos.

- [ ] **Passo 4: verificar** — o mesmo comando → PASS; G4 → exit 0.

- [ ] **Passo 5: commit**
```bash
git add plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs
git commit -m "E3 T6: add-decision, add-pending, inflight, ratify e reject" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Tarefa 7: varredura de bytes do critério 1, linha da regra e gates

**tier:** sonnet · **reviewTier:** sonnet · **external:** false · **needsLock:** nenhum · navegador: não

**Arquivos:**
- Modificar (teste): `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`
- Modificar (só se a varredura achar defeito): `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs`
- Modificar: `.claude/rules/roadmap-checker.md`

**Interfaces:**
- Consome: todos os comandos (Tarefas 3-6), `makeFolder`, `cli`.

- [ ] **Passo 1: teste do critério 1 (AC1).** Uma tabela de casos, um por comando de escrita (`log`, `set-status`, `integrate`, `block-open`, `block-close`, `prune`, `refresh-checker`, `add-decision`, `add-pending`, `inflight-add`, `inflight-remove`, `ratify`, `reject`), cada um com a preparação mínima (`mutate`) para que o comando de fato grave algo. Rodar cada caso em duas variantes: `{ eol: '\n' }` e `{ eol: '\r\n', bom: true, nfdLine: true }`, ambas com o painel tendo a linha `piece 1: integrated (\`<sha main>\`); piece 2: spec` e `git: true`. Para cada execução:
  - exit 0 e `changed` não vazio;
  - `spawnSync(process.execPath, [CHECKER, dir, '--json'])` → `summary.errors === 0`;
  - para cada arquivo da pasta: partir antes e depois com `splitLines`, alinhar pelo maior prefixo comum e maior sufixo comum de linhas (`text + eol`) e exigir que a janela do meio contenha só linhas que o comando declara tocar (no máximo as linhas dos blocos editados; o número de linhas alteradas por arquivo é no máximo o esperado do caso, ex. `ratify`: 1 em `decisions.md`, até 1 em `state.md`, 1 em `log.md`); e o BOM, o `eol` de toda linha fora da janela e a linha NFD continuam byte a byte iguais (comparar `Buffer`s);
  - arquivos fora de `changed` têm bytes idênticos.

- [ ] **Passo 2: rodar** — `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`. Esperado: PASS. Se falhar, corrigir `roadmap.mjs` (TDD: o caso já é o teste que falha) e rodar de novo até passar.

- [ ] **Passo 3: linha da regra.** Em `.claude/rules/roadmap-checker.md`, acrescentar um item: a CLI `roadmap-tracker/scripts/roadmap.mjs` (`node roadmap.mjs <comando> <pasta> [opções] [--json]`, `--help` lista os comandos) grava eventos do tracker trocando só as linhas tocadas e conferindo pelo checker antes de gravar; testes em `roadmap.test.mjs`.

- [ ] **Passo 4: verificação manual na pasta real (só leitura, Foco 3).**
  - `node plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs status docs/plans/roadmap-evolucao-skills` → exit 0, painel lido.
  - `node plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs brief docs/plans/roadmap-evolucao-skills` → exit 0 (ou 1 só se o checker da pasta real já acusa erro, o que se confere rodando G4-equivalente na pasta; não é defeito da CLI).
  - `git status --porcelain -- docs/plans/roadmap-evolucao-skills` → vazio (nada gravado).

- [ ] **Passo 5: gates** (todos exit 0, como no baseline; nenhuma falha é esperada):
  - G1: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` → exit 0, total maior que 959, 0 falhando.
  - G2: `claude plugin validate .` → exit 0.
  - G3: `claude plugin validate plugins/productivity-tools` → exit 0.
  - G4: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` → exit 0, 0 erros, 0 avisos.
  - G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` → exit 0.
  - `node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` → exit 0.
  - `head -1 plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` → `// check-roadmap 1.5.0 format 1`; `git diff main...HEAD -- plugins/productivity-tools/.claude-plugin/plugin.json README.md` → vazio.

- [ ] **Passo 6: commit** (só os arquivos alterados desta tarefa)
```bash
git add plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs .claude/rules/roadmap-checker.md
# e, se o Passo 2 exigiu correção:
git add plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs
git commit -m "E3 T7: varredura de bytes do critério 1 e regra da CLI" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```
Depois: `git status --porcelain` vazio (diferença só de final de linha: `git checkout -- <arquivo>`).

---

## Acceptance criteria evidence

Todos os critérios são `verify: test` com o comando do card; o arquivo de teste é criado na Tarefa 1 e os casos de cada critério nas tarefas indicadas. Nenhum comando tem efeito externo: só lê e escreve em pastas temporárias do sistema.

| ac | kind | command | testRef | external | externalDedupe |
|---|---|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` | `roadmap.test.mjs`: varredura de bytes por comando de escrita, LF e CRLF+BOM+NFD (Tarefa 7) | false | - |
| AC2 | test | `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` | `roadmap.test.mjs`: next-id BLQ depois de block-open/block-close e com BLQ-7 fora dos acompanhados (Tarefa 5) | false | - |
| AC3 | test | `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` | `roadmap.test.mjs`: set-status status-backward e segment-required sem alterar bytes (Tarefa 4) | false | - |
| AC4 | test | `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` | `roadmap.test.mjs`: add-decision, add-pending e inflight-add idempotentes (Tarefa 6) | false | - |
| AC5 | test | `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` | `roadmap.test.mjs`: ratify e recusas not-executor/not-pending (Tarefa 6) | false | - |
| AC6 | test | `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` | `roadmap.test.mjs`: reject com linha nova de origem user e a antiga substituída (Tarefa 6) | false | - |

Quando um passo não puder ser exercido neste ambiente (ex.: git indisponível no PATH), a evidência aceitável é o teste correspondente pulado com motivo explícito em `t.skip('git indisponível')` e o restante da suíte verde; nenhuma tarefa deste plano depende de navegador, servidor, credencial ou ato humano.
