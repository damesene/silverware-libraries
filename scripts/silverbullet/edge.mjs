// SilverBullet's edge builds (its main branch, rebuilt as it changes) as an image, the one place it is named:
// npm run test:ui:sb:edge (scripts/ui-tests.mjs) and CI's edge tests (.github/workflows/edge-tests.yml) take it.
// On Windows scripts/silverbullet.mjs runs its release `edge` instead, the same build.
export const EDGE_IMAGE = "ghcr.io/silverbulletmd/silverbullet:edge-slim";
