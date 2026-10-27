import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Normalises raw text or AI outputs containing HTML tags (<br>, <p>)
 * and misformatted markdown so react-markdown parses proper paragraphs,
 * headings, numbered lists, and bullet points.
 */
export function normalizeMarkdown(content: string): string {
  if (!content) return "";
  let text = String(content);

  // 1. Replace HTML line breaks and paragraph/div tags with newlines
  text = text.replace(/<\s*br\s*\/?>/gi, "\n");
  text = text.replace(/<\s*\/p\s*>/gi, "\n\n");
  text = text.replace(/<\s*p[^>]*>/gi, "\n\n");
  text = text.replace(/<\s*\/div\s*>/gi, "\n");
  text = text.replace(/<\s*div[^>]*>/gi, "\n");

  // 2. Unescape common HTML entities
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&lt;/gi, "<");
  text = text.replace(/&gt;/gi, ">");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&quot;/gi, '"');

  // 3. Ensure headings (#, ##, ###, etc.) start on their own line with a blank line before
  text = text.replace(/([^\n])\s*(#{1,6}\s+[^\n]+)/g, "$1\n\n$2\n");

  // 4. Wrap common file paths with known extensions in backticks if not already wrapped
  text = text.replace(
    /(?:^|(?<=[\s(,;]))([a-zA-Z0-9_./-]+\.(?:py|ts|tsx|js|jsx|json|md|rs|go|java|c|cpp|h|toml|yaml|yml|css|html))(?:$|(?=[\s),;]))/g,
    "`$1`"
  );

  // 5. Wrap identifier-like paths or underscore symbols in backticks to prevent broken markdown italics/bold
  text = text.replace(
    /(?:^|(?<=[\s(,;]))(_[a-zA-Z0-9_]+(?:\/)?|[a-zA-Z0-9_]+\/_[a-zA-Z0-9_]+\/?)(?:$|(?=[\s),;]))/g,
    "`$1`"
  );

  // 6. Process line by line to organize title headers, nested lists, and subheaders
  const lines = text.split("\n");
  const processed: string[] = [];
  let inNumberedList = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      processed.push("");
      continue;
    }

    // Ignore stray empty heading tags (e.g. '#' or '##') with no content
    if (/^#{1,6}\s*$/.test(trimmed)) {
      continue;
    }

    // Check if the very first line is a document title without markdown formatting
    if (
      i === 0 &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("-") &&
      !trimmed.startsWith("*") &&
      !/^\d+\./.test(trimmed) &&
      !/[.!?:,]$/.test(trimmed) &&
      trimmed.length <= 80 &&
      lines.length > 1
    ) {
      processed.push(`## ${trimmed}`);
      continue;
    }

    // Check if line is a numbered list item: e.g. "1. Public API..."
    const numMatch = trimmed.match(/^(\d+\.\s+)(.*)$/);
    if (numMatch) {
      inNumberedList = true;
      processed.push(trimmed);
      continue;
    }

    // Check if line is a bullet item: e.g. "- Exports..."
    const bulletMatch = trimmed.match(/^([-*]\s+)(.*)$/);
    if (bulletMatch) {
      if (inNumberedList) {
        // Indent bullet under the numbered item so CommonMark treats it as a nested sub-list
        processed.push("   " + trimmed);
      } else {
        processed.push(trimmed);
      }
      continue;
    }

    // If it's a heading (#...), reset list state
    if (trimmed.startsWith("#")) {
      inNumberedList = false;
      processed.push(trimmed);
      continue;
    }

    // If it's a short title/subhead preceding a bullet list (e.g. "Unified Sync/Async API" followed by "- Identical...")
    let nextNonEmpty = "";
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim()) {
        nextNonEmpty = lines[j].trim();
        break;
      }
    }

    if (nextNonEmpty.startsWith("- ") || nextNonEmpty.startsWith("* ")) {
      if (!trimmed.endsWith(".") && !trimmed.endsWith(":") && trimmed.length < 80) {
        inNumberedList = false;
        processed.push(`#### ${trimmed}`);
        continue;
      }
    }

    inNumberedList = false;
    processed.push(trimmed);
  }

  text = processed.join("\n");
  // Normalize excessive blank lines (more than 2 consecutive newlines)
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Renders the synthesised answer. The backend returns markdown, so we style a
 * small allow-list of elements by hand rather than pulling in a prose plugin.
 */
const components: Components = {
  p: ({ children }) => (
    <p className="mb-3 leading-relaxed last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 leading-relaxed">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 leading-relaxed">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-4 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => (
    <h2 className="mt-4 mb-2 font-heading text-base font-semibold first:mt-0 text-foreground">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 font-heading text-base font-semibold first:mt-0 text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3.5 mb-1.5 font-heading text-sm font-semibold first:mt-0 text-foreground">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2.5 mb-1 font-heading text-sm font-semibold text-foreground">
      {children}
    </h4>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-primary/50 pl-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border/70" />,
  br: () => <br className="my-1" />,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg border border-border/70 bg-muted/40 p-3 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  ),
};

export function AnswerMarkdown({ children }: { children: string }) {
  const normalized = normalizeMarkdown(children);
  return (
    <div className="text-[0.95rem] [&_pre>code]:bg-transparent [&_pre>code]:p-0 [&_pre>code]:text-inherit">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {normalized}
      </Markdown>
    </div>
  );
}
