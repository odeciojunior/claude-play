// Orçamento de prosa do contexto principal do planner (E4, critério 3).
// Spec: docs/superpowers/specs/2026-11-11-E4-planner-scaffold-rubrica-design.md,
// seção "Meta derivada de prosa" (SRC-02 §1, commit bf9d948; DEC-034).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

// Linha de base: SKILL + clarify + decompose + formats em LF no commit bf9d948.
// Spec, seção "Meta derivada de prosa" (SRC-02 §1, commit bf9d948; DEC-034).
// A constante segue a estratégia se a revisão registrar outro valor.
const BASELINE_LF = 74602;

// Meta: a linha de base menos a leitura inteira de formats.md (31.267 bytes).
// Spec, seção "Meta derivada de prosa" (SRC-02 §1, commit bf9d948; DEC-034).
// A constante segue a estratégia se a revisão registrar outro valor.
const TARGET_LF = 43335;

const COUNTED = ['SKILL.md', 'references/clarify.md', 'references/decompose.md', 'references/model.md'];
const EXCLUDED = {
  'references/formats.md': 'contrato de formato, consultado por seção (§n) e lido também pelo tracker e pelo checker',
  'references/review-rubric.md': 'lido só pelo subagent revisor, não pelo contexto principal',
};

const read = (rel) => readFileSync(join(SKILL_DIR, rel), 'utf8').replace(/\r\n?/g, '\n');

test('a soma LF dos arquivos contados cabe na meta', () => {
  const sum = COUNTED.reduce((n, f) => n + Buffer.byteLength(read(f)), 0);
  assert.ok(sum <= TARGET_LF, `soma ${sum} excede a meta ${TARGET_LF} em ${sum - TARGET_LF} bytes`);
});

test('a meta é a linha de base menos formats.md', () => {
  assert.equal(TARGET_LF, BASELINE_LF - 31267);
});

test('todo arquivo de references/ está em exatamente um dos dois conjuntos', () => {
  const found = readdirSync(join(SKILL_DIR, 'references')).map((f) => `references/${f}`).sort();
  const counted = COUNTED.filter((f) => f !== 'SKILL.md');
  assert.equal(new Set(counted).size + Object.keys(EXCLUDED).length, new Set([...counted, ...Object.keys(EXCLUDED)]).size);
  assert.deepEqual(found, [...counted, ...Object.keys(EXCLUDED)].sort());
});

test('menções a formats.md levam § e review-rubric.md aparece só como tarefa do revisor', () => {
  for (const f of COUNTED) {
    const text = read(f);
    for (const m of text.matchAll(/formats\.md/g)) {
      const next = text.slice(m.index + m[0].length, m.index + m[0].length + 15);
      assert.ok(next.includes('§'), `${f}: "formats.md" sem § nos 15 caracteres seguintes: ${JSON.stringify(next)}`);
    }
    for (const line of text.split('\n')) {
      if (line.includes('review-rubric.md')) {
        assert.ok(/reviewer|revisor/.test(line), `${f}: review-rubric.md fora do contexto do revisor: ${line}`);
      }
    }
  }
});
