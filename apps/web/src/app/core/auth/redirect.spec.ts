import { safeNext } from './redirect';

describe('safeNext', () => {
  it.each([
    ['/settings', '/settings'],
    ['/recipes?q=soup', '/recipes?q=soup'],
    [null, '/recipes'],
    ['', '/recipes'],
    ['settings', '/recipes'],
    // other origins
    ['https://evil.test', '/recipes'],
    ['//evil.test/x', '/recipes'],
    ['/\\evil.test', '/recipes'],
    // the auth pages, so `next` can't chain into someone else's sign-in link
    ['/auth/confirm?token_hash=abc', '/recipes'],
    ['/sign-in', '/recipes'],
    ['/sign-in?next=%2Fsettings', '/recipes'],
    ['/authors', '/authors'],
  ])('%s → %s', (next, expected) => {
    expect(safeNext(next)).toBe(expected);
  });
});
