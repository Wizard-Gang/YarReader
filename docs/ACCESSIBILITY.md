# Accessibility

YarReader targets a WCAG 2.2-aligned portable-reader experience. This is an
engineering posture, not an accessibility certification or conformance claim.

Deterministic acceptance belongs in the Vitest browser suite. It covers the
portable document landmarks and heading order, accessible control names and
state, keyboard reachability and shortcuts, page/image alternatives, live
status semantics, responsive reading-mode controls, non-color-only active
state, and the separation between reading direction and document
language/direction metadata.

## Manual browser acceptance

Only behavior that depends on real rendering or assistive technology stays
manual:

- In a current desktop browser, tab through the library and reader at normal
  and narrow/mobile widths and at 200% zoom. Focus must remain visibly
  identifiable, reachable, and unobscured; all reader operations must remain
  available without pointer input.
- With operating-system high-contrast or forced-colors support enabled, verify
  selected filters/views and focused controls remain distinguishable without
  relying on color alone.
- With a screen reader, smoke-test the library and one reader unit: the main
  landmark and primary heading are announced, controls expose useful names and
  state, page/result status changes are understandable, and page alternatives
  identify their position in the unit.

Do not turn these manual checks into a certification statement. If a check can
be made deterministic in the repository, move it into the automated browser
suite instead of expanding this list.
