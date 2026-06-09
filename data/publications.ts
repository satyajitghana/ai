// Peer-reviewed publications. Feeds /publications, /api/publications, and the
// JSON-LD ScholarlyArticle entries. Stable, rarely-edited record.

export type Publication = {
  title: string
  journal: string
  volume: number
  issue: number
  pages: string
  year: number
  doi: string
  authors: string[]
  url: string
}

export const publications: Publication[] = [
  {
    title:
      "Adaptive Visual Learning Using Augmented Reality and Machine Learning Techniques",
    journal: "Journal of Computational and Theoretical Nanoscience",
    volume: 17,
    issue: 11,
    pages: "4952–4956",
    year: 2020,
    doi: "10.1166/jctn.2020.8982",
    authors: ["Satyajit Ghana", "Shikhar Singh", "Aryan Jalali", "Vivek Badani"],
    url: "https://doi.org/10.1166/jctn.2020.8982",
  },
]

export const scholarUrl =
  "https://scholar.google.com/citations?user=rZCRakQAAAAJ"
