# E38: Arnês, limpeza de processos e conferência Linux real de `verify-run procs`

Data: 2026-11-21. Branch `release/pos-2.3.0`. Entregável `E38` (`REQ-005`, `REQ-006`, `DEC-010`, `DEC-011`). Relatório sujeito à conferência humana de `AC2` (`H1` em `docs/plans/pos-2-3-0-E38/spec.md`).

## Resumo das entregas de código (`AC1`)

| Item | Arquivo(s) | Commit | Mudança e verificação |
|---|---|---|---|
| `B10` | `tools/measure/session-metrics.mjs`, `session-metrics.test.mjs` | `625fcab` | Exporta `isFixLabel` e ancora em `/-fix\d*$/`, excluindo `*-fix-review` e `*-fix-probe` de `r.fixAgents` (`23/23` testes, `scanPrivacy` limpo). |
| `B23 / S3-07` | `tools/measure/baseline.mjs`, `baseline.test.mjs` | `7a2a470` | `mergeVariant` prioriza `superpowers` dos parciais com `valid > 0` e `buildMarkdown` cita `Divergência de superpowers aceita por <DEC>.` em `linha-de-base.md` (`35/35` testes). |
| `B11` | `plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.mjs`, `verify-run.test.mjs` | `e52c2d7` | Exporta `parseCreationDate(v)` (`/Date(ms)/`, DMTF, ISO-8601), consulta `CreationDate` em `Win32_Process` e corta vínculo `ppid` com `parent.created > child.created` em `selectProcs` (`skip`, `inWt`) e `runProcs` (`underPath`) (`42/42` testes). |
| `B09` | `tools/measure/run-batch.mjs`, `run-batch.test.mjs` | `5c9d8ab` | Exporta e integra `KILLER_RE`, `defaultListProcs`, `detectExternalKiller`, `checkProcessPreflight` e `createProcessSentinel` em `runBatch`; reprova pré-voo (`preflight-processo-matador`), invalida tentativa atingida (`morto-por-processo-externo`) e registra eventos redigidos em `private/sentinel.log` (`221/221` testes somando `run-batch.test.mjs` e `session-metrics.test.mjs`, `scanPrivacy` limpo). |

Suíte completa de `AC1` (`node --test tools/measure/session-metrics.test.mjs tools/measure/run-batch.test.mjs tools/measure/baseline.test.mjs plugins/productivity-tools/skills/roadmap-release/scripts/verify-run.test.mjs`): **298 testes, 298 aprovados, 0 falhas, 0 pulados**.

## Conferência Linux / WSL2 real de `verify-run.mjs procs` (`B12 / AC2`, `DEC-011`)

### Ambiente e observação operacional do WSL2

- **Host / Kernel:** `Linux cognitus 6.6.114.1-microsoft-standard-WSL2 #1 SMP PREEMPT_DYNAMIC Mon Dec  1 20:46:23 UTC 2025 x86_64 GNU/Linux` (distro `ubuntu`, WSL 2)
- **Binários reais exercitados:**
  - `node`: `v20.19.5` (`/home/<user>/.nvm/versions/node/v20.19.5/bin/node`)
  - `ps`: `ps from procps-ng 4.0.4` (`/usr/bin/ps`)
  - `lsof`: `lsof` revisão `4.95.0` (`/usr/bin/lsof`)
- **Sessão fora de worktree:** script isolado executado em `/tmp/e38-linux-verify-<pid>` com `cp` somente leitura de `verify-run.mjs`, `verify-run.test.mjs` e `lib/plan-digest.mjs` do repositório e remoção em `trap EXIT`.
- **Nota operacional:** ao chamar `wsl.exe` sem `--cd ~` a partir de uma sessão Windows neste ambiente, a tradução do CWD Windows / inicialização de perfil interativo excedeu o timeout de 8 s; com `wsl.exe -d ubuntu --cd ~ -e /bin/sh`, o kernel e os comandos Linux responderam em menos de 3 s.

### Exercício ponta a ponta com processos e portas TCP reais

Cenário montado em `/tmp/e38-wt-KSybtU` (worktree alvo simulada fora do repositório) e `/tmp/e38-other-oWaOuu` (diretório externo de controle):

- **Pai (`pid 758`, `ppid 747`):** processo `node` carregando `/tmp/e38-wt-KSybtU` na linha de comando.
- **Filho listener (`pid 772`, `ppid 758`):** processo `node` sem o caminho `/tmp/e38-wt-KSybtU` na linha de comando, ouvindo na porta TCP real `127.0.0.1:39454`.
- **Ouvinte externo (`pid 759`, `ppid 747`):** processo `node` com `/tmp/e38-other-oWaOuu`, ouvindo na porta TCP real `127.0.0.1:39120` dentro do intervalo pedido `[39120, 39454]`.

Listagens reais capturadas imediatamente antes da chamada a `verify-run.mjs procs` (nomes de usuário redigidos como `<user>`):

**`ps -eo pid=,ppid=,args=` (`exit 0`, linhas filtradas para os 3 PIDs):**

```text
    758     747 /home/<user>/.nvm/versions/node/v20.19.5/bin/node -e const c=require('child_process').spawn(process.execPath,['-e',"const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port)+'\\n')});setInterval(()=>{},1000);"],{stdio:['ignore','pipe','ignore']});c.stdout.on('data',d=>process.stdout.write(c.pid+' '+d));setInterval(()=>{},1000); /tmp/e38-wt-KSybtU
    759     747 /home/<user>/.nvm/versions/node/v20.19.5/bin/node -e const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port)+'\n')});setInterval(()=>{},1000); /tmp/e38-other-oWaOuu
    772     758 /home/<user>/.nvm/versions/node/v20.19.5/bin/node -e const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port)+'\n')});setInterval(()=>{},1000);
```

**`lsof -nP -iTCP -sTCP:LISTEN` (`exit 0`, cabeçalho e listeners do ensaio):**

```text
COMMAND PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node    759 <user>   18u  IPv4  49204      0t0  TCP 127.0.0.1:39120 (LISTEN)
node    772 <user>   18u  IPv4  15754      0t0  TCP 127.0.0.1:39454 (LISTEN)
```

**Saída JSON assinada de `node verify-run.mjs procs <payload>` (`exit 0`):**

```json
{
  "tool": "verify-run",
  "mode": "procs",
  "nonce": "e38-linux:0",
  "matched": [
    {
      "pid": 758,
      "why": "path",
      "cmd": "/home/<user>/.nvm/versions/node/v20.19.5/bin/node -e const c=require('child_process').spawn(process.execPath,['-e',\"const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{process.stdout.wri"
    },
    {
      "pid": 772,
      "why": "port 39454"
    }
  ],
  "ended": [
    772,
    758
  ],
  "failed": [],
  "unchecked": [
    "pid 759 listens on port 39120 in the range, but neither it nor an ancestor carries the worktree path: not ended"
  ],
  "digest": "5a91795e"
}
```

**Conferência pós-`SIGTERM` (400 ms depois via `process.kill(pid, 0)`):**

- `parent` (`pid 758`): `false` (`ESRCH` -- encerrado por `SIGTERM`).
- `child` (`pid 772`): `false` (`ESRCH` -- encerrado primeiro por `SIGTERM`, sem expor `cmd` no item `port 39454`).
- `outsider` (`pid 759`): `true` (preservado vivo fora do worktree, apenas relatado em `unchecked`, e encerrado pelo `finally` do ensaio).

### Subconjunto `procs` de `verify-run.test.mjs` no Ubuntu WSL2

Comando: `node --test --test-name-pattern="procs" verify-run.test.mjs`

- Resultado no Linux real: **`11 pass, 0 fail`** (2 testes exclusivos `win32` pulados pela guarda `{ skip: process.platform !== 'win32' }` e 29 testes não-`procs` filtrados por `--test-name-pattern`), incluindo `E32 procs: end to end ends a child whose command line carries the worktree` (`553.8 ms`).
