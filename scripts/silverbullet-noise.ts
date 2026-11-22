// Errors SilverBullet itself logs in the browser's console, none of a plugin's: each plugin's UI tests fail a test on
// any error of the page but these (its helpers.ts `page` fixture), each kept here with why it is no failure of ours.
// A plugin's own exceptions (a 404 it does not avoid, a browser's warning of its own) stay in its helpers.

const NOISE: readonly { readonly pattern: RegExp; readonly why: string }[] = [
  {
    // SilverBullet's index worker, busy (a CI runner under load, a test's pages indexed while others' are): a page's
    // indexing given up after 30 s, said as the event that asked for it failed
    pattern: /indexDocument|document:index/,
    why: "SilverBullet's indexing of a page timed out (its worker busy under load)",
  },
  {
    // SilverBullet after 2.12.1, as it starts (2026-11-22): its commands told before its editor is made,
    // `commandsUpdated` dispatching to an editor view not there yet (its stack in its client alone)
    pattern: /commandsUpdated[\s\S]*reading 'dispatch'|reading 'dispatch'[\s\S]*commandsUpdated/,
    why: "SilverBullet's commands told before its editor is made, as it starts",
  },
];

/** Whether an error of the page's console is SilverBullet's own, none of a plugin's (`NOISE`) */
export function silverBulletsOwnError(text: string): boolean {
  return NOISE.some((one) => one.pattern.test(text));
}
