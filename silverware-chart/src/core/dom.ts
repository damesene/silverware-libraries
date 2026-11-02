// What Silverware Chart assumes about SilverBullet's DOM, in one place.

/**
 * The button SilverBullet puts by a code block (Copy, `sb-code-copy-button`,
 * in the block's first line, above its widget's top right corner): the
 * chart's toolbar goes left of it
 */
export function copyButtonOf(box: HTMLElement): HTMLElement | undefined {
  return box.closest(".cm-line")?.querySelector<HTMLElement>(".sb-code-copy-button") ?? undefined;
}
