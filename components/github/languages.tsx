import type { GitHubLanguage } from "@/data/github-dummy"

// Stacked language bar — one rounded bar split into colored segments by each
// language's percentage, plus a mono legend.

export function Languages({ languages }: { languages: GitHubLanguage[] }) {
  if (languages.length === 0) return null

  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        {languages.map((lang) => (
          <div
            key={lang.name}
            style={{ width: `${lang.pct}%`, backgroundColor: lang.colorHex }}
            title={`${lang.name} ${lang.pct}%`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {languages.map((lang) => (
          <li
            key={lang.name}
            className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground"
          >
            <span
              className="inline-block size-2 rounded-[2px]"
              style={{ backgroundColor: lang.colorHex }}
            />
            <span className="text-foreground">{lang.name}</span>
            <span>{lang.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
