// api/_lib/apoio/log.ts
// Logger do pipeline de Envio ao Apoio (port de PipelineLog do envio_alvaro).
// Cada etapa registra entradas que voltam no campo `log` da resposta — a UI mostra
// o passo a passo (OCR, apLIS, XML) para o operador auditar antes de enviar.

export type NivelLog = 'INFO' | 'OK' | 'WARN' | 'ERROR' | 'SEND' | 'RECV';

export interface EntradaLog {
  level: NivelLog;
  msg: string;
  detail?: unknown;
}

const ICONES: Record<NivelLog, string> = {
  INFO: 'ℹ', OK: '✓', WARN: '⚠', ERROR: '✗', SEND: '→', RECV: '←',
};

export class PipelineLog {
  private entries: EntradaLog[] = [];

  private add(level: NivelLog, msg: string, detail?: unknown): void {
    const entry: EntradaLog = { level, msg };
    if (detail !== undefined && detail !== null) entry.detail = detail;
    this.entries.push(entry);
    console.log(`[apoio-pipeline] ${ICONES[level]} ${msg}`);
  }

  info(msg: string, detail?: unknown): void { this.add('INFO', msg, detail); }
  ok(msg: string, detail?: unknown): void { this.add('OK', msg, detail); }
  warn(msg: string, detail?: unknown): void { this.add('WARN', msg, detail); }
  error(msg: string, detail?: unknown): void { this.add('ERROR', msg, detail); }
  send(msg: string, detail?: unknown): void { this.add('SEND', msg, detail); }
  recv(msg: string, detail?: unknown): void { this.add('RECV', msg, detail); }

  toList(): EntradaLog[] { return this.entries; }
}
