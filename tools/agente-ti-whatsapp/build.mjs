// tools/agente-ti-whatsapp/build.mjs — `npm run eva-build-outbox`
//
// Gera em tools/agente-ti-whatsapp/dist/ o necessário para rodar a fila na VPS SEM clonar o
// repositório (modo "arquivo único" do install.sh):
//   eva-whatsapp.mjs → send-outbox.ts com tudo dentro (rotina, domínio e @supabase/supabase-js);
//                      só precisa de Node 18+
//   install.sh       → o instalador, com fim de linha LF (no Windows o checkout fica CRLF,
//                      e um .sh com CRLF quebra no bash)
//   versao.txt       → commit e data do build, para saber o que está rodando na VPS
// A pasta dist/ é ignorada pelo git. Nenhuma chave entra no arquivo: elas ficam no ambiente.
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const saida = join(aqui, 'dist');
const arquivo = join(saida, 'eva-whatsapp.mjs');
mkdirSync(saida, { recursive: true });

await build({
  entryPoints: [join(aqui, 'send-outbox.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outfile: arquivo,
  legalComments: 'none',
  logLevel: 'warning',
  // Dependências CommonJS dentro de um bundle ESM ainda chamam require().
  banner: { js: "import { createRequire as __eva_createRequire } from 'node:module'; const require = __eva_createRequire(import.meta.url);" },
  // Uma dependência do supabase-js usa o "punycode" nativo, depreciado: o Node avisaria a cada
  // execução e o journal encheria a cada minuto. A barra final aponta para o pacote do npm.
  alias: { punycode: 'punycode/' },
});

// O shebang do .ts aponta para o tsx; o arquivo único roda direto no node.
const js = readFileSync(arquivo, 'utf8').replace(/^#!.*\r?\n/, '');
writeFileSync(arquivo, `#!/usr/bin/env node\n${js}`);
chmodSync(arquivo, 0o755);

writeFileSync(join(saida, 'install.sh'), readFileSync(join(aqui, 'install.sh'), 'utf8').replace(/\r\n/g, '\n'));
chmodSync(join(saida, 'install.sh'), 0o755);

let commit = 'desconhecido';
try { commit = execSync('git rev-parse --short HEAD', { cwd: aqui }).toString().trim(); } catch { /* fora de um checkout */ }
writeFileSync(join(saida, 'versao.txt'), `EVA fila do WhatsApp — commit ${commit} — gerado em ${new Date().toISOString()}\n`);

const kb = Math.round(readFileSync(arquivo).length / 1024);
console.log(`Gerado ${arquivo} (${kb} KB, commit ${commit}).`);
console.log(`Copie para a VPS: eva-whatsapp.mjs e install.sh (pasta ${saida}).`);
