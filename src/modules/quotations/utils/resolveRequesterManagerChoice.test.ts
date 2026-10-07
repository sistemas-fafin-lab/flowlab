import { describe, expect, it } from 'vitest';
import { resolveRequesterManagerChoice } from './resolveRequesterManagerChoice';

const comprador = { id: 'comprador', name: 'Comprador' };
const quemAbriuSc = { id: 'user-sc', name: 'Quem abriu a SC' };
const quemAbriuManutencao = { id: 'user-manut', name: 'Quem abriu a manutenção' };
const outro = { id: 'outro', name: 'Outro' };
const enviando = { id: 'enviando', name: 'Outro comprador enviando' };
const ativos = [comprador, quemAbriuSc, quemAbriuManutencao, outro, enviando];

const compras = { quotationType: 'compras' as const, createdBy: 'comprador' };
const contratacao = { quotationType: 'contratacao' as const, createdBy: 'comprador' };
const origem = { requestRequestedByUserId: 'user-sc', maintenanceRequesterId: 'user-manut' };

const ids = (users: { id: string }[]) => users.map((u) => u.id);

describe('resolveRequesterManagerChoice', () => {
  it('Compras com SC conhecida: gestor travado em quem abriu a SC', () => {
    const choice = resolveRequesterManagerChoice({ quotation: compras, source: origem, activeUsers: ativos, currentUserId: 'comprador' });

    expect(choice.lockedManagerId).toBe('user-sc');
    expect(choice.suggestedId).toBe('user-sc');
    expect(ids(choice.eligibleUsers)).toEqual(['user-sc']);
  });

  it('Contratação: gestor travado em quem abriu a solicitação de manutenção', () => {
    const choice = resolveRequesterManagerChoice({ quotation: contratacao, source: origem, activeUsers: ativos, currentUserId: 'comprador' });

    expect(choice.lockedManagerId).toBe('user-manut');
    expect(ids(choice.eligibleUsers)).toEqual(['user-manut']);
  });

  it('origem travada vale mesmo se a cotação já tiver outro gestor gravado', () => {
    const choice = resolveRequesterManagerChoice({
      quotation: { ...compras, requesterManagerId: 'outro' }, source: origem, activeUsers: ativos, currentUserId: 'comprador',
    });

    expect(choice.lockedManagerId).toBe('user-sc');
    expect(choice.suggestedId).toBe('user-sc');
  });

  it('sem origem conhecida: escolha livre, sem o comprador nem quem está enviando', () => {
    const choice = resolveRequesterManagerChoice({ quotation: compras, source: {}, activeUsers: ativos, currentUserId: 'enviando' });

    expect(choice.lockedManagerId).toBeNull();
    expect(choice.suggestedId).toBeNull();
    expect(ids(choice.eligibleUsers)).toEqual(['user-sc', 'user-manut', 'outro']);
  });

  it('criador da origem inativo: não trava, comprador escolhe', () => {
    const choice = resolveRequesterManagerChoice({
      quotation: compras, source: origem, activeUsers: [comprador, outro], currentUserId: 'comprador',
    });

    expect(choice.lockedManagerId).toBeNull();
    expect(ids(choice.eligibleUsers)).toEqual(['outro']);
  });

  it('SC aberta pelo próprio comprador: não trava (seria autoaprovação) e ele não é elegível', () => {
    const choice = resolveRequesterManagerChoice({
      quotation: compras, source: { requestRequestedByUserId: 'comprador' }, activeUsers: ativos, currentUserId: 'comprador',
    });

    expect(choice.lockedManagerId).toBeNull();
    expect(ids(choice.eligibleUsers)).not.toContain('comprador');
  });

  it('SC aberta por quem está enviando: também não trava', () => {
    const choice = resolveRequesterManagerChoice({
      quotation: compras, source: { requestRequestedByUserId: 'enviando' }, activeUsers: ativos, currentUserId: 'enviando',
    });

    expect(choice.lockedManagerId).toBeNull();
    expect(ids(choice.eligibleUsers)).not.toContain('enviando');
  });

  it('sem trava, sugere o gestor já gravado (reenvio) quando ele continua elegível', () => {
    const choice = resolveRequesterManagerChoice({
      quotation: { ...compras, requesterManagerId: 'outro' }, source: {}, activeUsers: ativos, currentUserId: 'comprador',
    });

    expect(choice.suggestedId).toBe('outro');
  });

  it('não sugere um gestor gravado que deixou de ser elegível (ex.: o próprio comprador)', () => {
    const choice = resolveRequesterManagerChoice({
      quotation: { ...compras, requesterManagerId: 'comprador' }, source: {}, activeUsers: ativos, currentUserId: 'comprador',
    });

    expect(choice.suggestedId).toBeNull();
  });
});
