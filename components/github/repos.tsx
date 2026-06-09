import type { GitHubRepo } from "@/data/github-dummy"

// Top repositories — one row each: linked name, muted one-line description,
// and a right-aligned mono "★ n · lang".

export function Repos({ repos }: { repos: GitHubRepo[] }) {
  return (
    <ul className="space-y-4">
      {repos.map((repo) => (
        <li key={repo.name} className="group">
          <div className="flex items-baseline justify-between gap-4">
            <a
              href={repo.url}
              className="font-medium underline-offset-4 group-hover:underline"
            >
              {repo.name}
            </a>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              ★ {repo.stars} · {repo.language}
            </span>
          </div>
          {repo.description ? (
            <p className="mt-1 line-clamp-1 text-sm leading-6 text-muted-foreground">
              {repo.description}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
