import { describe, expect, it } from 'vitest';
import { resolveBoardAccess } from './resolveBoardAccess';

describe('resolveBoardAccess', () => {
  it('sem cargo (custom_role_id nulo) não tem acesso a nenhum board', () => {
    expect(resolveBoardAccess(null)).toEqual({ kind: 'none' });
    expect(resolveBoardAccess(undefined)).toEqual({ kind: 'none' });
  });

  it('cargo sem board_id e sem canManageAllBoards não tem acesso a nenhum board', () => {
    expect(resolveBoardAccess({ boardId: null, permissions: [] })).toEqual({ kind: 'none' });
  });

  it('cargo com board_id mas sem canManageBoard só visualiza', () => {
    expect(resolveBoardAccess({ boardId: 'transporte', permissions: [] })).toEqual({
      kind: 'single',
      boardId: 'transporte',
      canManage: false,
    });
  });

  it('cargo com board_id e canManageBoard visualiza e gerencia', () => {
    expect(resolveBoardAccess({ boardId: 'transporte', permissions: ['canManageBoard'] })).toEqual({
      kind: 'single',
      boardId: 'transporte',
      canManage: true,
    });
  });

  it('canManageAllBoards dá acesso total a todos os boards, independente do cargo', () => {
    expect(resolveBoardAccess({ boardId: null, permissions: ['canManageAllBoards'] })).toEqual({ kind: 'all' });
  });

  it('canManageAllBoards prevalece mesmo quando o cargo também tem um board_id próprio', () => {
    expect(
      resolveBoardAccess({ boardId: 'transporte', permissions: ['canManageBoard', 'canManageAllBoards'] }),
    ).toEqual({ kind: 'all' });
  });
});
