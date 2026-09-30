import { TestBed } from '@angular/core/testing';
import {
  FakeAuthRepository,
  fakeSession,
  provideFakeAuth,
} from '../../../testing/fake-auth';
import { AuthStore } from './auth.store';

describe('AuthStore', () => {
  function setup(email?: string) {
    const repository = new FakeAuthRepository(email);
    TestBed.configureTestingModule({
      providers: [provideFakeAuth(repository)],
    });
    return { repository, store: TestBed.inject(AuthStore) };
  }

  it('starts from the saved session', () => {
    const { store } = setup('a@example.test');
    expect(store.status()).toBe('signed-in');
    expect(store.email()).toBe('a@example.test');
  });

  it('is signed out without a saved session', () => {
    const { store } = setup();
    expect(store.status()).toBe('signed-out');
    expect(store.email()).toBe('');
  });

  it('follows sign-in and sign-out, including from other tabs', async () => {
    const { repository, store } = setup();
    await store.verifyCode('a@example.test', '123456');
    expect(store.status()).toBe('signed-in');

    repository.setSession(null); // e.g. signed out elsewhere
    expect(store.status()).toBe('signed-out');

    repository.setSession(fakeSession('b@example.test'));
    expect(store.email()).toBe('b@example.test');
  });

  it('settles once the saved session has been read', async () => {
    const repository = new FakeAuthRepository('a@example.test', {
      settled: false,
    });
    TestBed.configureTestingModule({
      providers: [provideFakeAuth(repository)],
    });
    const store = TestBed.inject(AuthStore);
    let settled = false;
    void store.whenSettled().then(() => (settled = true));
    await Promise.resolve();
    expect(store.status()).toBe('loading');
    expect(settled).toBe(false);

    repository.settle();
    await store.whenSettled();
    expect(store.status()).toBe('signed-in');
  });

  it('stops watching when destroyed', () => {
    const { repository, store } = setup();
    TestBed.resetTestingModule();
    repository.setSession(fakeSession('a@example.test'));
    expect(store.status()).toBe('signed-out');
  });
});
