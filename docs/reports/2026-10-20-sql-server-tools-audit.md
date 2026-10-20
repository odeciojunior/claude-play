# Auditoria do plugin sql-server-tools 1.0.0

Oct 20, 2026 · @Odécio Machado

## Resumo

O plugin passa em `claude plugin validate`, mas o validador só checa o manifest. Os agents não conseguem fazer o que prometem: quatro dos cinco declaram `tools: Read, Grep, Glob` e mandam o modelo consultar DMVs e catalog views. Nenhum tem acesso ao MCP. O conteúdo técnico é razoável, com erros pontuais de T-SQL e lacunas grandes de cobertura (Azure SQL, Query Store, segurança de deploy).

**Decisão tomada:** os agents passam a executar consultas **read-only ao vivo** via `mcp-sql-server`, com fallback para scripts quando o MCP não estiver disponível. Plano de implementação: `docs/plans/2026-10-20-sql-server-tools-v1.1-plan.md`.

## Método

Cinco subagents em paralelo, cada um com uma lente:

| Lente | Modelo | Escopo |
|---|---|---|
| Correção T-SQL | Sonnet | monitor, tuner, tsql-specialist |
| Correção T-SQL | Sonnet | schema-discovery, code-reviewer |
| Arquitetura e integração | Sonnet | tools, MCP, spec, roteador |
| Referências cruzadas | Haiku | nomes de agents, roteador vs descrições, README |
| Lint | Haiku | frontmatter, versões, markdown, EOL, tamanho |

Mais um `claude-code-guide` para confirmar regras de frontmatter na documentação oficial. Achados HIGH ou mais graves foram conferidos no arquivo. A integração com o MCP foi conferida no código instalado do servidor (`mcp_sql_server/security.py`, `tools/query_execution.py`).

## Restrições do mcp-sql-server que moldam o plano

Lidas no código do servidor, não na documentação:

1. `execute_query` só aceita texto cujo primeiro token seja `SELECT` ou `WITH`.
2. Bloqueia, em **qualquer lugar do texto** (comentários e literais inclusive), as palavras inteiras `DROP TRUNCATE ALTER CREATE GRANT REVOKE SHUTDOWN BACKUP RESTORE DBCC OPENROWSET OPENQUERY OPENDATASOURCE BULK KILL`, e qualquer identificador começando com `sp_` ou `xp_`.
3. Embrulha a query em `SELECT TOP n * FROM (<sql>) AS _limited_query`. Consequências:
   - `WITH` (CTE) passa na validação mas **falha na execução**: CTE não pode ficar dentro de tabela derivada. Isso é um bug do mcp-sql-server, que deve ser reportado no repositório dele.
   - `ORDER BY` só é válido com `TOP` na própria query.
   - Toda coluna precisa de nome único (`SELECT @@VERSION` sem alias falha).
   - `OPTION (...)` não é aceito.
4. Parâmetros usam `?` posicional; não há `DECLARE` nem lotes com várias instruções.
5. Nome do servidor registrado pelo `setup.sh`: `mcp-sql-server` → ferramentas `mcp__mcp-sql-server__<tool>`.

## Achados

### P0: o plugin não funciona como anunciado

| # | Problema | Onde |
|---|---|---|
| 1 | Nenhum agent executa SQL: allowlist sem ferramentas MCP, mas o corpo manda consultar | `agents/*.md:5`, `sql-performance-monitor.md:35-38`, `sql-schema-discovery.md:27-31` |
| 2 | `permissionMode: plan` é ignorado em agents de plugin (docs oficiais: "Ignored fields: permissionMode, hooks, mcpServers, initialPrompt") | 4 agents, linha 8 |
| 3 | Monitor manda consultar DMVs e, na linha 212, proíbe executar T-SQL | `sql-performance-monitor.md:212` |
| 4 | Nenhum agent menciona MCP nem tem comportamento quando ele falta | todos |
| 5 | README e SKILL ensinam registrar o servidor como `sql-server`; o setup registra `mcp-sql-server` | `README.md:38`, `SKILL.md:42` |
| 6 | tsql-specialist tem Edit, Write e Bash, sem regras de execução | `tsql-specialist.md:5` |
| 7 | Template padrão do tsql-specialist usa `WITH (NOLOCK)` | `tsql-specialist.md:166` |

### P1: erros técnicos

**sql-schema-discovery**
- `:142` afirma que `sys.sql_expression_dependencies` só rastreia referências schema-bound. Errado: rastreia ambas (`is_schema_bound_reference`).
- `:135` junta `dm_db_partition_stats` sem agregar → linhas duplicadas em tabelas particionadas.
- `:111-117` casa dependências só por `referenced_entity_name` → falsos positivos entre schemas.
- `:75-89` não filtra `ep.class = 1`, filtra só `t.name` (sem schema), mostra `max_length` em bytes.
- `:124-131` usa colunas que não existem em versões antigas (`is_node`, `temporal_type`, `is_memory_optimized`) sem checar versão.

**sql-code-reviewer**
- Dois esquemas de severidade sem mapeamento (checklists CRITICAL/HIGH/MEDIUM/LOW; relatório CRITICAL/WARNING/SUGGESTION).
- `:109` recomenda `ISNULL`/`COALESCE` no WHERE (não-SARGable, contradiz `:95`).
- `:108` "NOLOCK on write operations" já é erro de compilação; o risco real é NOLOCK em leitura.
- `:111` guard de trigger errado; o correto é `IF @@ROWCOUNT = 0 RETURN` e lógica set-based.
- Sem `THROW` vs `RAISERROR` e sem `XACT_STATE()` no CATCH.

**sql-performance-tuner**
- `:61` reescrita SARGable muda a semântica (`col >= @date` no lugar de `YEAR(col) = @year`); viola `:155`.
- `:78` OR não usa index intersection (isso é AND); reescrita certa é `UNION ALL`.

**sql-performance-monitor**
- Waits e `dm_io_virtual_file_stats` são cumulativos desde o restart, mas o fluxo não manda calcular delta.
- Missing index recomendado sem ressalva (`:64-66`).
- `CXCONSUMER` tratado como problema; BCHR citado como métrica válida.

**tsql-specialist**
- Pivot dinâmico (`:89-96`) quebra com colunas extras ou `@cols` NULL.
- `AVG(int)` faz divisão inteira; `ROWS 6 PRECEDING` são 7 linhas, não 7 dias.
- Paginação sem desempate no ORDER BY.
- `:77` "Scalar UDFs force serial" contradiz `:65` (inlining no 2019).

### P2: lacunas de cobertura

- Azure SQL DB e Managed Instance: nenhuma menção, e sem detecção de plataforma (`SERVERPROPERTY('EngineEdition')`) nem de permissões.
- Monitor sem nenhuma query pronta: o modelo improvisa DMVs de memória.
- Tuner: sem Query Store, PSP/IQP, estatísticas, leitura de `.sqlplan`.
- Reviewer: sem segurança de deploy, MERGE/upsert, cursors, `@@IDENTITY`, isolamento.
- Schema discovery: sem triggers, check constraints, sinônimos, sequences, particionamento, permissões/RLS.
- Tabela de versões termina no SQL 2022 e omite níveis de compatibilidade.

### P3: arquitetura

1. Boilerplate repetido nos 5 agents (detecção de ambiente, severidade, escalação, memória).
2. Sem skills de workflow (`/sql-health-check`, `/sql-review`, `/sql-explain`, `/sql-describe`).
3. O roteador aconselha o usuário em vez de instruir o modelo a chamar `sql-server-tools:<agent>`; sobra referência a `productivity-tools` (`SKILL.md:35`).
4. Sem hook de segurança para `execute_statement`/`execute_procedure`.
5. Tabelas de escalação supõem que um subagent chama outro, o que não acontece.
6. `memory: user` mistura convenções e detalhes de servidor de projetos diferentes.
7. Monitor em Opus com `maxTurns: 30` para trabalho majoritariamente mecânico.

### P4: cosméticos

3 agents acima de 200 linhas; 6 blocos sem tag de linguagem; grafia de `WITH(NOLOCK)` variável; README afirma "Version-aware" (`:51`) para agents que não checam versão.

## Fora do plano 1.1.0

Ficam para um plano seguinte:

- Cobertura de P2 além do necessário para as queries do plano (Query Store, PSP/IQP, deploy safety completo, SQL 2025).
- Skills de workflow com slash command (P3.2).
- Hook de escrita (P3.4). Com o tsql-specialist sem Bash e sem `execute_statement`, nenhum agent do plugin escreve no banco.
- Bug de CTE no `mcp-sql-server` (repositório externo).

## Não confirmado

- Colunas internas de graph tables em `sys.columns`.
- Cobertura da lista de waits benignos para 2019+.
- Lista de features do SQL 2025.
- Se um agent de projeto com o mesmo nome sobrescreve um agent de plugin (namespaced).
- Se `memory` concede Write/Edit a um agent cuja allowlist não os inclui.
