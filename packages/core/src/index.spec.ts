describe('@mise/core', () => {
  it('loads', async () => {
    await expect(import('./index')).resolves.toBeDefined();
  });
});
