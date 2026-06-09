import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// Compact markdown for streamed chat answers — matches the editorial/mono theme.
// Kept small and self-contained so it renders well inside the chat console.
export function ChatMarkdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 leading-6 [&_li]:my-0.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => (
            <a
              {...props}
              target={props.href?.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="underline decoration-foreground/40 underline-offset-2 transition-colors hover:decoration-foreground"
            />
          ),
          p: (props) => <p {...props} className="my-1" />,
          ul: (props) => (
            <ul {...props} className="my-1 list-disc space-y-0.5 pl-4" />
          ),
          ol: (props) => (
            <ol {...props} className="my-1 list-decimal space-y-0.5 pl-4" />
          ),
          code: (props) => (
            <code
              {...props}
              className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
            />
          ),
          pre: (props) => (
            <pre
              {...props}
              className="my-2 overflow-x-auto rounded border bg-muted/50 p-2 font-mono text-xs [&_code]:bg-transparent [&_code]:p-0"
            />
          ),
          strong: (props) => <strong {...props} className="font-semibold" />,
          h1: (props) => <p {...props} className="mt-2 font-semibold" />,
          h2: (props) => <p {...props} className="mt-2 font-semibold" />,
          h3: (props) => <p {...props} className="mt-2 font-semibold" />,
          table: (props) => (
            <div className="my-2 overflow-x-auto">
              <table {...props} className="w-full border-collapse text-xs" />
            </div>
          ),
          th: (props) => (
            <th
              {...props}
              className="border-b px-2 py-1 text-left font-medium text-muted-foreground"
            />
          ),
          td: (props) => (
            <td {...props} className="border-t px-2 py-1 align-top" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
