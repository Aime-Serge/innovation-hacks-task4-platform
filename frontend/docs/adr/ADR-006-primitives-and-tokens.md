# ADR-006 (Pack ADR-006, 007): Radix primitives and design tokens

**Status:** Accepted

- Dialog, drawer, dropdown menu, tooltip, toast and avatar use Radix primitives for keyboard and ARIA behaviour.
- The checkbox is a native input, not Radix. Radix's checkbox renders a hidden input with an inline `style` attribute in the server HTML, which the strict CSP (`style-src 'self'`) blocks. See ADR-011.
- Tokens are CSS variables in `src/styles/tokens.css`, exposed to Tailwind through `@theme`. `scripts/check-tokens.ts` fails the lint step on a raw colour, arbitrary Tailwind value or inline style outside that file.
- `tests/unit/contrast.test.ts` computes contrast ratios from the token file in both themes. It found one real failure (dark progress fill on its track, 2.98:1), fixed by changing `--color-track`.
