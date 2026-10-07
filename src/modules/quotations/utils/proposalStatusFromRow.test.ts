import { describe, expect, it } from 'vitest';
import { proposalStatusFromRow } from './proposalStatusFromRow';

describe('proposalStatusFromRow', () => {
  it('a vencedora é "selected", mesmo com outro status gravado', () => {
    expect(proposalStatusFromRow({ is_winner: true, status: 'rejected' })).toBe('selected');
  });

  it('mantém "rejected"', () => {
    expect(proposalStatusFromRow({ is_winner: false, status: 'rejected' })).toBe('rejected');
  });

  it('qualquer outro status vira "submitted"', () => {
    expect(proposalStatusFromRow({ is_winner: null, status: 'under_review' })).toBe('submitted');
    expect(proposalStatusFromRow({ is_winner: false, status: null })).toBe('submitted');
  });
});
