// Command hashes. A link like `#repos` runs the `repos` command; a link that
// must run a multi-word command (the Friends link runs `cat friends`) encodes
// the space as %20 so the fragment stays URL-safe: `#cat%20friends`. Decode it
// back to a command string here, shared by the terminal link handler and the
// hash router on load.
export function commandFromHash(hash: string): string {
  const raw = hash.replace(/^#/, '').trim();
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
