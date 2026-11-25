// Só para testes: acha o Git Bash sem depender do PATH (no Windows, o "bash" do PATH pode ser o do System32/WSL).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// PT_BASH definida volta como está; fora do win32, 'bash'; no win32, bin/bash.exe da instalação do git, ou null.
export function gitBash() {
  if (process.env.PT_BASH) return process.env.PT_BASH;
  if (process.platform !== 'win32') return 'bash';
  try {
    const execPath = execFileSync('git', ['--exec-path'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    for (const up of [['..', '..', '..'], ['..', '..']]) {
      const candidate = join(execPath, ...up, 'bin', 'bash.exe');
      if (existsSync(candidate)) return candidate;
    }
  } catch { /* sem git */ }
  return null;
}
