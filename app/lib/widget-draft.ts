/** The fragment stays client-side; a draft never authorizes sending or execution. */
export function readWidgetDraft(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (!params.has("morice-draft")) return null;
  // Preserve the full draft for correction; the composer enforces its send limit.
  return params.get("morice-draft") ?? "";
}
