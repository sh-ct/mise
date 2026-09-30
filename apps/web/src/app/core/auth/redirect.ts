export const HOME = '/recipes';

/** Paths that must not follow sign-in: other origins (`//host`, `/\host`) and the auth pages themselves. */
const UNSAFE_NEXT = /^\/[/\\]|^\/(?:sign-in|auth)(?:[/?#]|$)/;

/**
 * A same-app page to return to after sign-in; anything else goes home. Excluding the auth pages means a
 * crafted `next` can't chain the user into someone else's sign-in link.
 */
export function safeNext(next: string | null | undefined): string {
  return next?.startsWith('/') && !UNSAFE_NEXT.test(next) ? next : HOME;
}
