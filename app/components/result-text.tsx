import { type Citation, safeWebUrl } from "../lib/web-result";

export function ResultText({ text, citations = [] }: { text: string; citations?: Citation[] }) {
  const pieces = []; let cursor = 0;
  for (const citation of [...citations].sort((a, b) => a.start - b.start)) {
    if (!safeWebUrl(citation.url) || citation.start < cursor || citation.end > text.length) continue;
    pieces.push(text.slice(cursor, citation.start));
    const label = text.slice(citation.start, citation.end);
    pieces.push(<a key={`${citation.start}-${citation.url}`} href={citation.url} target="_blank" rel="noopener noreferrer">{/[]/.test(label) ? `[${citation.title}]` : label}</a>);
    cursor = citation.end;
  }
  pieces.push(text.slice(cursor));
  return <p className="result-text">{pieces}</p>;
}
