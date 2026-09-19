// DEPRECATED — kept only so any stray import keeps compiling.
//
// Design tokens now live in app/globals.css as CSS custom properties, which is
// what the whole app reads from. Inline style objects can't express media
// queries, :hover, :focus or animation, which is why the UI had none of those.
// Use the CSS classes (.btn, .card, .input, …) or var(--violet-700) instead.
export const theme = {
  purple: 'var(--violet-700)',
  purpleDark: 'var(--violet-900)',
  purpleLight: 'var(--violet-100)',
  yellow: 'var(--yellow-400)',
  yellowDark: 'var(--yellow-600)',
  white: 'var(--white)',
  ink: 'var(--ink)',
  gray: 'var(--gray)',
  border: 'var(--line)',
  error: 'var(--error)',
};
