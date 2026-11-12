# E17: branch de volta productivity-tools-1.7.1

Data: 2026-11-12. Branch local `volta/productivity-tools-1.7.1` (nunca enviada ao remoto, DEC-036), criada na Tarefa 7 (externa, autorizada pelo dono em pessoa).

- `M` (pai): `e38cb355de668a334193bd46d783d6f0e6313d5f`
- Commit da volta: `a5b819feb6027d027e85c755d318d19649073f7b` (`E17 T7: volta productivity-tools 1.7.1 (conteúdo da tag 1.6.0)`)
- Dedupe: `git rev-parse --verify --quiet refs/heads/volta/productivity-tools-1.7.1` saiu 1 (não existia) antes de criar.
- Conteúdo: `plugins/productivity-tools/` igual à tag `productivity-tools--v1.6.0` (`3fbb59b`), exceto o diff abaixo; `marketplace-tools` fica como em `M` (1.2.0).

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

Voltados ao estado da tag (`git checkout productivity-tools--v1.6.0 --`), por descreverem código do plugin novo: `.claude/agents/plugin-reviewer.md`, `.claude/rules/roadmap-checker.md`.

## Gates na árvore da volta

| Gate | Comando | Exit | Resumo |
|---|---|---|---|
| G1 (1ª rodada) | `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` | 1 | tests 788, pass 776, fail 12 (7 arquivos de tools/measure e `E25 AC5: the real productivity-tools SKILL.md declares the grant`) |
| G1 (após voltar tools/.claude) | idem | 1 | tests 777, pass 776, fail 1 |
| G2 | `claude plugin validate .` | 0 | Validation passed |
| G3 | `claude plugin validate plugins/productivity-tools` | 0 | Validation passed |
| G4 | `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` | 0 | 0 error(s), 0 warning(s) |
| G5 | `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` | 0 | 40 OK, 0 WARN, 0 FAIL |

## Pendência para o dono (critério 4 não atendido no G1)

Falha restante, dentro de outro plugin e por isso não contornada: `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs:770` (`E25 AC5: the real productivity-tools SKILL.md declares the grant`) espera `Workflow(productivity-tools:release-workflow)` no SKILL.md real de `productivity-tools`, que na tag 1.6.0 não existe (a skill `roadmap-release` é posterior). Sem esse teste G1 daria exit 0. Decisão do dono: aceitar a falha como inerente à volta, ou ajustar o teste do `marketplace-tools` na volta (fora do escopo da Tarefa 7).
