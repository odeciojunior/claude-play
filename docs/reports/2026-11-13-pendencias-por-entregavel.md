# Pendências arquivadas por entregável

Data: 2026-11-13.

Notas retiradas de `docs/plans/roadmap-evolucao-skills/state.md` por DEC-673 (pendências voltam ao limite de 20); cada grupo fica ligado ao entregável ou portão que o consome, com o texto copiado literalmente.

## E11

- (executor) Incerto, rever na preparação de E17 e na nota de E11: a receita de fixar a loja numa tag foi vista com fonte git local; repetir com a loja do GitHub na primeira tag publicada, e ver como uma sessão aberta reage enquanto a loja fica ignorada (DEC-056).
- (executor) tools/measure: SANDBOX_RELEASE_RULES cita Workflow(productivity-tools:roadmap-release), nome antigo e inerte; trocar por Workflow(productivity-tools:release-workflow) quando alguém mexer no arnês. Workflow sem conteúdo já cobre.
- (executor) Fora de E17: spec-review-atual.md não casa com o workflow em HEAD sob nenhuma normalização; checkpoint.mjs não o confere. Resolver antes de medir a classe spec.
- (executor) E11: medir se specs do autor trazem critério que contradiz ruling ou caso de borda (AC6 do critério 2 de E19) ou critério ampliado por ruling sem citá-lo (AC3/R3); se repetir, acrescentar ao passo 6 de spec-author.md.
- (executor) Antes de E11: explicar por que coordinator variou com a skill idêntica (sonnet 2 para 3, bytes da sessão principal 1423 para 5378, turnos 17 para 26) e propor tolerância ou mais execuções; E7 muda essa skill.
- (executor) E11, preparação: na config descartável, fixar o superpowers e desligar a atualização automática das lojas antes da 1ª execução; conferir o commit do superpowers antes de cada lote e parar se mudou. Decidir a versão de referência (E15 em 7.0.0, E17 misto).
- (executor) baseline.mjs: a divergência de superpowers vira erro global e saída 1 mesmo com decisão do dono; avaliar registrar a versão por variante e aceitar a divergência citando a decisão, com teste.
- (executor) Rever depois de E8: a retomada repete setup, progress e status-record (4 haiku a mais por execução em duas sessões); avaliar pular o registro já feito na 1ª sessão.
- (executor) E11, preparação: tools/measure ainda espera os artefatos de E5 em docs/superpowers (make-scenario.mjs, E5_PATHS) e ratifica decisões entre as sessões de parada-retomada (DEC-442); adaptar aos caminhos de DEC-537 e à exceção de retomada antes de medir o release nativo.
- (executor) E20/gatilho: spec-3 (pt/en) passa direto a spec-author sem chamar Skill; a config descartável tem CLAUDE.md de usuário com regras de roteamento. Na próxima medição (E11), rodar spec-3 numa config sem CLAUDE.md de usuário ou contar o despacho a spec-author como rota do plugin.
- (executor) E11: a variante parada-retomada mede a meta de E23 de ponta a ponta (opus 9 para 7, ponderado 669 para 589) com o release nativo; o comportamental de E23 só confere os estágios, um a um.

## Gate DEC-458

- (dono) Não bloqueia: o caminho com AskUserQuestion da adoção nunca foi exercido em sessão interativa; observar na primeira adoção real e registrar o resultado.
- (executor) E20/N5-1: no passo 3 da adoção do plan-writer, a mensagem de aprovação deve colar literais a seção ## Adoção, o --stat do diff (acima de 200 linhas) e a saída de summary, sem resumir. Conferir com 1 execução claude -p até APPROVAL QUESTION. Portão: DEC-458.
- (executor) E20/N5-2: no passo 4 do plan-author, valor que o plano antigo não declara (deps, score, effort, título encurtado) entra como acrescentado ou derivado, nunca mantido; coluna sem campo no bloco (Test reference) ganha linha. Junto com N5-1.
- (executor) E20/cobertura: a adoção não exerceu a recusa (apaga o provisório, original intacto), o caminho com AskUserQuestion, as fontes 2 a 4 da busca do spec nem spec-author. Exercer ao menos a recusa e o spec do card na conferência de N5-1.
- (dono) Correção pós-merge de N5-1 e N5-2 conferida antes de publicar plan-writer (DEC-458)
- (executor) E20/cadeia: antes de publicar plan-writer, 1 execução claude -p de spec-writer e plan-writer com tópico <slug>-E<n>: id E<n>, check --roadmap em 0 e roadmap gravado no plano. spec-writer não compara critérios com o card. Portão: DEC-458.

## E12

- (executor) E25 F3: o lint não confere allowed-tools em commands/*.md nem em caminhos customizados do plugin.json; rever quando um plugin ganhar um dos dois ou no spec de E12.
- (executor) E12: escolhas do executor de E7 fora do registro: portão de onda devido só sem passo aberto na onda; baseline.md ao lado do estado (run.baseline sem uso); sem evento para agentId pós-launch nem handoff; code no --json de recusa.
- (executor) E12: se a description do plan-coordinator mudar, rodar de novo os 3 casos plan-execution (pt e en) em opus antes de integrar e registrar em docs/reports/.

## E13

- (executor) Texto de model.md em E4 sem prazo de publicação: W3 (questions só para retomada), W7 (releaseBranch ausente) e a parte de texto de W5 (relatório comportamental de E4).

## E28 ou próxima edição do release workflow

- (executor) E28: em task-reviewer.md, verdicts só no modo restrito e spec/quality só no modo review (ponto 2 do relatório comportamental de E21). Hoje o script ignora esses campos fora do modo. Se E28 for descartado, a linha sai junto com o texto do modo review (DEC-600).
- (executor) Achados menores do comportamental de E23 (fora do portão): sync lê "run after the merge" como argumento run do key; key imprime o prep inteiro em recorded e haiku o corrompe (tirar o prep); setup instala no diretório corrente e não no worktree; progresso sem a regra de comando simples.
- (executor) fix/carga-plano: resumeFromRunId de execução anterior à mudança, mesmo caminho de plugin, pode comparar emit completo com enxuto e parar em plan-frozen-tasks falso; normalizar em authoredTask ou avisar em operator.md. plan-author.md:40 descreve o emit com data em vez de plan.
- (executor) Preflight/skill: diagnosticar "not found" do lançamento pelo nome como script acima de 512 KiB (docs/reports/2026-11-13-E8-limite-lancamento-workflow.md).
- (executor) Defeito baixo (comportamental de E10): runPrompt (roadmap-release.js:1434) termina com BASH_ONLY, que pede lista vazia com error no-bash, incompatível com S_RUN {exit, stdout} e com script-runner.md:23; usar variante sem a frase da lista.
- (executor) Próxima edição de roadmap-release.js (E28 ou fix): erro determinístico do script de descoberta ({ tool, error }) repete 5 vezes; parar na 1ª resposta com error. Tratar junto o defeito do BASH_ONLY em runPrompt.
