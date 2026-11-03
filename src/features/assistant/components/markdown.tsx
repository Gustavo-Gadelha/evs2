"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// HTML cru na resposta nunca é renderizado (sem rehype-raw): o react-markdown o mostra como texto.
const components: Components = {
  p: ({ node: _node, ...props }) => <p className="leading-7" {...props} />,
  h1: ({ node: _node, ...props }) => <h1 className="mt-2 text-lg font-semibold" {...props} />,
  h2: ({ node: _node, ...props }) => <h2 className="mt-2 text-base font-semibold" {...props} />,
  h3: ({ node: _node, ...props }) => <h3 className="mt-1 text-[15px] font-semibold" {...props} />,
  h4: ({ node: _node, ...props }) => <h4 className="font-semibold" {...props} />,
  ul: ({ node: _node, ...props }) => <ul className="flex list-disc flex-col gap-1.5 pl-6 marker:text-muted-foreground" {...props} />,
  ol: ({ node: _node, ...props }) => (
    <ol className="flex list-decimal flex-col gap-1.5 pl-6 marker:text-muted-foreground" {...props} />
  ),
  li: ({ node: _node, ...props }) => <li className="leading-7 [&>ol]:mt-1.5 [&>ul]:mt-1.5" {...props} />,
  a: ({ node: _node, ...props }) => (
    <a
      className="text-primary underline underline-offset-2 hover:opacity-80"
      target="_blank"
      rel="noreferrer noopener"
      {...props}
    />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className="border-l-2 border-border pl-4 text-muted-foreground" {...props} />
  ),
  hr: ({ node: _node, ...props }) => <hr className="my-2 border-border" {...props} />,
  pre: ({ node: _node, ...props }) => (
    <pre
      className="scrollbar-thin overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-[13px] leading-relaxed [&>code]:bg-transparent [&>code]:p-0"
      {...props}
    />
  ),
  code: ({ node: _node, ...props }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]" {...props} />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="scrollbar-thin overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-[13px]" {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }) => <thead className="bg-muted/50" {...props} />,
  th: ({ node: _node, ...props }) => <th className="border-b border-border px-3 py-2 font-medium" {...props} />,
  td: ({ node: _node, ...props }) => <td className="border-b border-border px-3 py-2 last:border-b-0" {...props} />,
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 text-[15px] text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
