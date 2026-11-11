# run-extra-revisao

Saída literal (resposta final) do subagent, opus, effort medium (revisão adversarial, só leitura). Fixture sintética.

---

**Veredito: a condição do dono para aceitar o critério 2 está cumprida.** Cada critério foi validado por uma única execução (n=1).

**Ordem dos commits:** e7211af (textos novos) vem antes de 6b4e190 (esperados e fixtures), que vem antes de eb86ddc (saídas). O `git diff 6b4e190 HEAD -- README.md` sai vazio, então os esperados não mudaram. As fixtures e `spec-e1-estreitado.md` entraram em 6b4e190, antes de rodar.

**Critério 2: PASSA**
- C1 cita `Non-goals`: `E2 (pieces, reqs), Non-goals` (pasta-extra-c2/decisions.md:9).
- C2 cita E1 e a definição de pronto: `E1 (definition of done)` (decisions.md:10).
- D1 (decisions.md:11) e D2 (decisions.md:12) têm `-`.
- A regra de passagem (README.md:19) é atendida com 2 de 2 contradições marcadas e 0 de 2 falsos positivos.
- O checker vendorizado, que rodei agora, dá 0 erros e 2 `contradiction-unabsorbed`, só para DEC-199 e DEC-200.

**Critério 3: PASSA**
- Há um único pendente `enfraquecido` para o critério 1, com 110 caracteres, abaixo do `cellChars: 300` (pasta-extra-c3/state.md:36, roadmap.config.json:32).
- Ele cita só o trecho que difere, como pede rubric-criteria.md:42.
- Nada foi gerado para o critério 2. A linha de log segue 19-criteria-check.md:7, e o checker dá 0 erros e 0 avisos.

**Textos novos: seguidos**
- Revisit está `-` nas quatro linhas, conforme 01-decision.md:9.
- O limite da célula foi respeitado, sem precisar encurtar e rodar de novo.

**Achados**
1. **Média, sobre robustez do acerto de C1 (não é falha).** `contradiz` saiu de pieces e `reqs`. `Non-goals` só entrou porque o subagente viu que REQ-003 está `out-of-scope`, e ele mesmo chama isso de "inferência minha" (run-extra-criterio-2.md:84). Ele não citou a regra de desempate "cutting a non-goal" (rubric-contradiction.md:30). O motivo está certo, mas a fixture só aponta para os Non-goals de forma indireta (strategy.md:14), então o acerto depende de o subagente ir ler `requirements.md`. Não foi acerto só por causa de `reqs`, mas com uma execução só, ele pode não se repetir.
2. **Baixa.** DEC-201 ficou com Deliverable `-`, embora o README fale em "detalhe em E1". É defensável, porque o texto do evento não nomeia E1, e não mexe no Contradicts.
3. **Baixa, de procedimento.** O pendente "(user) approve strategy v1.1…" (198 caracteres) foi gravado com `sed -i` em vez de `add-pending`, contrariando 09-revision.md:31. A proposta de revisão também não aparece na saída. Nenhuma das duas coisas afeta a classificação.
4. **Edições à mão em decisions.md: conformes.** 01-decision.md:10 diz que a CLI não acrescenta linhas com Origin `user`, então editar é o caminho previsto. Fazer isso com `sed -i` é aceitável. Nenhuma decisão anterior foi alterada, e os logs foram gravados pela CLI.

**Salto DEC-199: não invalida o teste**
- O que se testa é a célula Contradicts. O ID é só um rótulo, e o salto (001 para 199) não reaproveitou nenhum ID.
- A correção está confirmada: `next-id` na pasta-extra-c3, que tem o checker vendorizado, devolve hoje `DEC-002`.
- O único custo é estético na fixture, que vale deixar anotado no README se ela for reutilizada.

**Recomendação:** aceitar o critério 2. Se quiserem mais segurança sobre C1, repitam a execução com um subagente novo, ou com uma variante em que a seção Non-goals cite o item diretamente.
