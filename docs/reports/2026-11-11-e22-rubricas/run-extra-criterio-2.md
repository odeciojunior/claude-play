# run-extra-criterio-2

Saída literal (resposta final) do subagent, sonnet, effort medium. Fixture sintética.

---

Os quatro eventos estão gravados na pasta, e o checker passa com 0 erros e 2 avisos. Não escrevi a revisão da estratégia (v1.1): a regra 6 exige aprovação, então só deixei o item pendente.

## 1. Por evento

**Evento 1** (cliente mobile em E2). Linha em `decisions.md`:
`| DEC-199 | 2026-11-11 | E2 | The mobile client (REQ-003) is included in the first release, inside E2 | none stated | E2 (pieces, reqs), Non-goals | - | user | in-force |`
- **Classe:** `contradiz`. A decisão muda o que E2 entrega (pieces) e o `reqs` do card. Também toca Non-goals, que remete ao que está `out-of-scope` em `requirements.md`, onde REQ-003 está.
- **Outras mudanças:**
  - `log.md` ganhou uma linha, gravada pela CLI.
  - `state.md` ganhou o item pendente `(user) approve strategy v1.1 (absorbs DEC-199 ...)`.
  - Não alterei a cobertura de REQ-003 em `requirements.md` nem o card, porque isso mexe em card e só vale na revisão.

**Evento 2** (E1 pronto na branch de feature). Linha:
`| DEC-200 | 2026-11-11 | E1 | E1 counts as done when its acceptance passes on the feature branch, without waiting for the integration | none stated | E1 (definition of done) | - | user | in-force |`
- **Classe:** `contradiz`. O card de E1 diz "acceptance passes in the integration branch", e a decisão troca essa condição.
- **Outras mudanças:** linha no log. O item pendente de `state.md` passou a citar DEC-200 também ("absorbs DEC-199, DEC-200 ... E1 definition of done changes"). Não toquei no status do painel nem em `critical-path.md`.

**Evento 3** (identificador é UUID v4). Linha:
`| DEC-201 | 2026-11-11 | - | The identifier of each item is a UUID v4 | none stated | - | - | user | in-force |`
- **Classe:** `detalha`. O formato do identificador é um detalhe de implementação que nenhum card menciona, como o "SQLite" do exemplo da rubrica.
- **Outras mudanças:** só a linha no log.

**Evento 4** (compartilhamento de E2 envia o link por e-mail). Linha:
`| DEC-202 | 2026-11-11 | E2 | Sharing in E2 sends the link to the recipient by e-mail | none stated | - | - | user | in-force |`
- **Classe:** `detalha`. O risco do card diz que as regras de compartilhamento estão indefinidas. O e-mail só preenche essa lacuna e deixa o critério "o destinatário consegue abrir" como está.
- **Outras mudanças:** só a linha no log.

**Checker final:** 1.5.0 → 0 erros, 2 avisos `contradiction-unabsorbed`, para DEC-199 e DEC-200. Esperados até a revisão.

**Arquivos alterados** (todos na pasta, nada commitado):
- `decisions.md`
- `log.md`
- `state.md`
- `check-roadmap.mjs` (cópia do checker vendorizado)

## 2. Lidos e comandos, em ordem

**Lidos:**
1. `roadmap-tracker/SKILL.md`
2. Glob da pasta do roadmap
3. `references/events/01-decision.md`
4. `references/events.md`
5. `references/rubric-contradiction.md`
6. `decisions.md`
7. `strategy.md`
8. `state.md`
9. `requirements.md`
10. `critical-path.md`
11. `roadmap.config.json`
12. `roadmap-planner/references/formats.md`: título e índice via `head` e `grep`, depois o § 6 com Read
13. `log.md`, via `cat`
14. Primeira linha do `check-roadmap.mjs` da pasta, via `grep`
15. `scripts/roadmap.mjs` (`sed` nas linhas 105-185) e `grep` por "DEC-" em `check-roadmap.mjs`, para investigar o `next-id`. Isso foi além do que a skill manda ler, para esclarecer a ambiguidade 1.

**Comandos:**

| # | Comando | Saída |
|---|---|---|
| 1 | `roadmap.mjs brief` | 0 |
| 2 | `roadmap.mjs refresh-checker` | 0 (copiou o checker 1.5.0 e gravou uma linha no log) |
| 3 | `roadmap.mjs next-id DEC` | 0 (devolveu DEC-199) |
| 4 | `grep` por DEC no folder; `grep` por `next-id` em `roadmap.mjs` | 0 |
| 5 | `sed -n` em `roadmap.mjs` | 0 |
| 6 | `grep -on` em `check-roadmap.mjs` | 0 |
| 7 | Tentativa de `python3` com heredoc vazio | sem efeito (`python3` ausente, caiu no `echo nopy`) |
| 8 | `sed -i` em `state.md` (item pendente); `roadmap.mjs log` (evento 1); `next-id DEC` (devolveu DEC-200) | 0 |
| 9 | `sed -i` em `decisions.md` e `state.md` (evento 2); `cat decisions.md`; `sed -n` em `state.md` | 0 |
| 10 | `roadmap.mjs log` (evento 2); `next-id DEC` (devolveu DEC-201) | 0 |
| 11 | `sed -i` em `decisions.md` (evento 3); `roadmap.mjs log`; `next-id DEC` (devolveu DEC-202) | 0 |
| 12 | `sed -i` em `decisions.md` (evento 4); `roadmap.mjs log`; `node check-roadmap.mjs`; `grep` e `sed -n` de conferência | 0 |

O resultado do comando 7 é inferido do fluxo, porque o `sed` do comando 8 rodou normalmente. A saída `nopy` não apareceu no retorno.

## 3. Ambiguidades

1. **Numeração dos DEC.** O `brief` antes do refresh dizia que o próximo era DEC-002. Depois do `refresh-checker`, o `next-id` devolveu DEC-199. A CLI varre todos os arquivos da pasta, e o `check-roadmap.mjs` recém-copiado contém o texto "DEC-198" num comentário. Segui a CLI ao pé da letra e usei DEC-199 a DEC-202. Isso deixa um salto de numeração (001 → 199), mas nenhum ID foi reaproveitado. É um defeito provável da skill: o `next-id` deveria ignorar `check-roadmap.mjs`.
2. **Evento 1, classe e cobertura.** Escolhi `contradiz`. Deixei REQ-003 como `out-of-scope` e não editei os cards, porque a mudança de cobertura toca card. O item pendente cobre isso.
3. **Evento 1, célula Contradicts.** Escrevi "E2 (pieces, reqs), Non-goals". Os Non-goals só remetem ao que está `out-of-scope`, então essa parte é inferência minha.
4. **Evento 2, raio da mudança.** Tratei como `contradiz` só na definição de pronto de E1. Não mexi no status do painel nem em gates, e não há critério de status "integrated" para reescrever. Quem decidir a revisão deve ver se isso afeta o significado de `integrated` nos cards de E2 e E3.
5. **Evento 3, campo Deliverable.** Usei `-`, porque o identificador atravessa todos os itens e não pertence a um único E.
6. **Itens pendentes.** Nenhuma decisão superseda outra, então segui a recomendação "não superseded". Juntei DEC-199 e DEC-200 num único item pendente de aprovação da v1.1, em vez de dois itens.
7. **Ordem e granularidade dos logs.** Gravei um log por DEC, na ordem dos eventos, com a CLI.

Pending for the user: `(user) approve strategy v1.1 (absorbs DEC-199, DEC-200)`, já gravado em `state.md`.
