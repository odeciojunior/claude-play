#!/usr/bin/env node
// Validates the structural invariants of an .excalidraw document.
// Usage: node validate-excalidraw.mjs <file.excalidraw>
// Exit 0 + "OK", exit 1 + one line per problem, exit 2 on usage error.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateExcalidraw(doc) {
  const problems = [];
  const all = Array.isArray(doc?.elements) ? doc.elements : null;
  if (!all) return ['document has no "elements" array'];
  const els = all.filter((e) => e && e.isDeleted !== true);
  const byId = new Map();
  const seeds = new Map();

  for (const e of els) {
    if (byId.has(e.id)) problems.push(`duplicate id "${e.id}"`);
    else byId.set(e.id, e);
    if (e.seed !== undefined) {
      if (seeds.has(e.seed)) problems.push(`duplicate seed ${e.seed} ("${seeds.get(e.seed)}" and "${e.id}")`);
      else seeds.set(e.seed, e.id);
    }
  }

  const lists = (target, id, type) =>
    Array.isArray(target.boundElements) && target.boundElements.some((b) => b.id === id && b.type === type);

  for (const e of els) {
    if (e.type === 'arrow') {
      for (const side of ['startBinding', 'endBinding']) {
        const b = e[side];
        if (!b) continue;
        const target = byId.get(b.elementId);
        if (!target) {
          problems.push(`arrow "${e.id}" ${side} points to missing element "${b.elementId}"`);
        } else if (!lists(target, e.id, 'arrow')) {
          problems.push(`arrow "${e.id}" ${side} not mirrored: "${target.id}" boundElements lacks {id:"${e.id}", type:"arrow"}`);
        }
      }
    }
    if (e.type === 'text' && e.containerId) {
      const c = byId.get(e.containerId);
      if (!c) {
        problems.push(`text "${e.id}" containerId points to missing element "${e.containerId}"`);
      } else if (!lists(c, e.id, 'text')) {
        problems.push(`text "${e.id}" containerId "${c.id}": container boundElements lacks {id:"${e.id}", type:"text"}`);
      }
    }
  }
  return problems;
}

function main(argv) {
  if (argv.length !== 1) {
    console.error('usage: node validate-excalidraw.mjs <file.excalidraw>');
    return 2;
  }
  let raw;
  try {
    raw = fs.readFileSync(argv[0], 'utf8');
  } catch (err) {
    console.error(`cannot read ${argv[0]}: ${err.message}`);
    return 2;
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    console.log(`invalid JSON: ${err.message}`);
    return 1;
  }
  const problems = validateExcalidraw(doc);
  if (problems.length === 0) {
    console.log('OK');
    return 0;
  }
  for (const p of problems) console.log(p);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
