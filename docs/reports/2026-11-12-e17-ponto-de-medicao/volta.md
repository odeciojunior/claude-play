# E17: branch de volta productivity-tools-1.7.1

Data: 2026-11-12. Branch local `volta/productivity-tools-1.7.1` (nunca enviada ao remoto, DEC-036), criada na Tarefa 7 (externa, autorizada pelo dono em pessoa).

- `M` (pai): `e38cb355de668a334193bd46d783d6f0e6313d5f`
- Commit da volta: `a5b819feb6027d027e85c755d318d19649073f7b` (`E17 T7: volta productivity-tools 1.7.1 (conteúdo da tag 1.6.0)`)
- Ponta da branch: `a951ed589b443d6ab3f1a931992701d008393352` (`E17 T7: volta, teste de acoplamento do lint ajustado ao conteúdo da tag (decisão delegada)`), segundo commit sobre `a5b819f`; ver "Decisão delegada" abaixo.
- Dedupe: `git rev-parse --verify --quiet refs/heads/volta/productivity-tools-1.7.1` saiu 1 (não existia) antes de criar.
- Conteúdo: `plugins/productivity-tools/` igual à tag `productivity-tools--v1.6.0` (`3fbb59b`), exceto o diff abaixo; `marketplace-tools` fica em 1.2.0, com uma exceção: o teste `E25 AC5` de `lint-plugin.test.mjs` foi ajustado em `a951ed5` (ver "Decisão delegada"); o conteúdo restante é o de `M`.

## Diff contra a tag (plugins/productivity-tools)

Comando: `git diff productivity-tools--v1.6.0 volta/productivity-tools-1.7.1 -- plugins/productivity-tools`. Só `plugin.json` (versão), linha 1 do checker e as quatro asserções do teste dele (a linha 1101 é comentário e não mudou).

```diff
diff --git a/plugins/productivity-tools/.claude-plugin/plugin.json b/plugins/productivity-tools/.claude-plugin/plugin.json
index 1c02847..a23713f 100644
--- a/plugins/productivity-tools/.claude-plugin/plugin.json
+++ b/plugins/productivity-tools/.claude-plugin/plugin.json
@@ -1,7 +1,7 @@
 {
   "name": "productivity-tools",
   "description": "Research, analysis, planning, diagramming, and system health skills for strategic work",
-  "version": "1.6.0",
+  "version": "1.7.1",
   "author": {
     "name": "Odecio Machado",
     "email": "odeciojunior@gmail.com"
diff --git a/plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs b/plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs
index d2c0ef7..e12d0c4 100644
--- a/plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs
+++ b/plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs
@@ -1,4 +1,4 @@
-// check-roadmap 1.5.0 format 1
+// check-roadmap 1.7.1 format 1
 // Deterministic checker for roadmap folders (format contract: roadmap-planner/references/formats.md).
 // Single file, Node >= 18, no dependencies, no network. Vendored into each roadmap folder.
 import fs from 'node:fs';
diff --git a/plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs b/plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs
index 3f75305..0668933 100644
--- a/plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs
+++ b/plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs
@@ -147,9 +147,9 @@ function keepOneLogRow(files) {
 
 test('script header and constants', () => {
   const first = fs.readFileSync(SCRIPT, 'utf8').split(/\r?\n/)[0];
-  assert.equal(first, '// check-roadmap 1.5.0 format 1');
+  assert.equal(first, '// check-roadmap 1.7.1 format 1');
   assert.equal(FORMAT_VERSION, 1);
-  assert.equal(CHECKER_VERSION, '1.5.0');
+  assert.equal(CHECKER_VERSION, '1.7.1');
 });
 
 test('script imports only node: modules', () => {
@@ -415,7 +415,7 @@ test('git: neither local nor origin branch gives one warning, no false error', (
 test('cli --version', () => {
   const r = cli(['--version']);
   assert.equal(r.status, 0);
-  assert.equal(r.stdout.trim(), '1.5.0 format 1');
+  assert.equal(r.stdout.trim(), '1.7.1 format 1');
 });
 
 test('cli exit 0 on the valid fixture, with summary', () => {
@@ -525,7 +525,7 @@ test('fix2: CRLF fixture and CRLF script run through the CLI; CRLF header is rea
   const r = spawnScript(path.join(dir, 'check-roadmap.mjs'), os.tmpdir());
   assert.equal(r.status, 0, r.stdout + r.stderr);
   assert.match(r.stdout, /check-roadmap: 0 error\(s\)/);
-  assert.equal(spawnSync(process.execPath, [path.join(dir, 'check-roadmap.mjs'), '--version'], { encoding: 'utf8' }).stdout.trim(), '1.5.0 format 1');
+  assert.equal(spawnSync(process.execPath, [path.join(dir, 'check-roadmap.mjs'), '--version'], { encoding: 'utf8' }).stdout.trim(), '1.7.1 format 1');
   const cache = tmp('roadmap-cache-');
   const scripts = path.join(cache, 'mkt', 'productivity-tools', '1.3.0', 'skills', 'roadmap-tracker', 'scripts');
   fs.mkdirSync(scripts, { recursive: true });
```

Também mudou `README.md` (linha de `productivity-tools`: 1.7.0 para 1.7.1).

## Arquivos repo-only voltados à tag

Não existiam na tag (removidos com `git rm`), por falharem no G1 ao ler código do plugin ausente na tag (export `STOP_RESUME` de `make-sandbox.mjs`; `roadmap-planner/references/model.md` inexistente):

- `tools/measure/baseline.mjs`, `baseline.test.mjs`
- `tools/measure/checkpoint.mjs`, `checkpoint.test.mjs`
- `tools/measure/make-scenario.mjs`, `make-scenario.test.mjs`
- `tools/measure/prose-goals.mjs`, `prose-goals.test.mjs`
- `tools/measure/run-baseline.mjs`, `run-baseline.test.mjs`
- `tools/measure/run-batch.mjs`, `run-batch.test.mjs`
- `tools/measure/session-metrics.mjs`, `session-metrics.test.mjs`

Voltado ao estado da tag (`git checkout productivity-tools--v1.6.0 --`), por descrever código do plugin novo: `.claude/rules/roadmap-checker.md`. `.claude/agents/plugin-reviewer.md` também foi voltado à tag em `a5b819f`, mas `a951ed5` o restaurou ao conteúdo de `M`; na ponta da branch só `roadmap-checker.md` difere de `M` entre os arquivos de `.claude/`.

## Decisão delegada (commit a951ed5)

O G1 de `a5b819f` falhava em `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs:770` (`E25 AC5`), que exige o grant `Workflow(productivity-tools:release-workflow)` no SKILL.md de `roadmap-release`, inexistente no conteúdo da tag 1.6.0. A Tarefa 7 então parou com a falha aberta (a spec Peça 5 diz que falha de G1 dentro de outro plugin não é contornada). O decisor delegado do dono (regra Fable) depois decidiu ajustar esse teste na volta, em `a951ed5`:

- O teste passou a se chamar `volta 1.7.1: the real productivity-tools SKILL.md (tag 1.6.0 content) declares no grant and lints with 0 FAIL`: afirma que `allowed-tools` está ausente e que o lint do plugin real tem 0 FAIL.
- `.claude/agents/plugin-reviewer.md` foi restaurado ao conteúdo de `M`.
- Consequência: `marketplace-tools` na volta difere de `M` (só esse teste) apesar de seguir em 1.2.0. É uma exceção à frase da spec Peça 5 "marketplace-tools fica em 1.2.0 com o conteúdo de M", tomada por decisão delegada e que o dono pode reverter (`git revert a951ed5` na volta devolve o G1 a exit 1 com a falha acima).
- O diff de `plugins/productivity-tools` contra a tag não mudou: continua só `plugin.json`, linha 1 do checker e as quatro asserções do teste dele.

## Gates na árvore da volta (ponta `a951ed5`)

| Gate | Comando | Exit | Resumo |
|---|---|---|---|
| G1 | `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` | 0 | tests 777, pass 777, fail 0 |
| G2 | `claude plugin validate .` | 0 | Validation passed |
| G3 | `claude plugin validate plugins/productivity-tools` | 0 | Validation passed |
| G4 | `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` | 0 | 0 error(s), 0 warning(s) |
| G5 | `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` | 0 | 40 OK, 0 WARN, 0 FAIL |

Histórico em `a5b819f` (antes de `a951ed5`): G1 exit 1 (tests 777, pass 776, fail 1, a falha acima); G2 a G5 exit 0.

## Critério 4

Atendido na ponta `a951ed5`: G1 a G5 com exit 0. A exceção em `marketplace-tools` (acima) fica registrada para o dono ratificar ou reverter.
