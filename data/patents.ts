// USPTO non-provisional applications — "Patent Pending". Feeds /patents,
// /api/patents, and JSON-LD. Status is real: filed, pending examination.

export type Patent = {
  title: string
  status: "pending"
  applicationNumber: string // US application no.
  filingDate: string // YYYY-MM-DD
  confirmationNumber: string
  docket: string
  inventors: string[]
  assignee: string
  priority: {
    country: string // e.g. "IN"
    number: string
    date: string // YYYY-MM-DD
  }
  claims: {
    total: number
    independent: number
  }
}

export const patents: Patent[] = [
  {
    title:
      "Method and System for Performing Structural Defect Analysis in a Structural Environment",
    status: "pending",
    applicationNumber: "19/634,310",
    filingDate: "2026-03-31",
    confirmationNumber: "7336",
    docket: "ALL.8733.USU1",
    inventors: ["Manish Kumar Giri", "Satyajit Ghana", "Adit Deven Doshi"],
    assignee: "Inkers Technology Private Limited",
    priority: {
      country: "IN",
      number: "202541073783",
      date: "2025-08-02",
    },
    claims: {
      total: 20,
      independent: 3,
    },
  },
  {
    title: "Data Acquisition Device",
    status: "pending",
    applicationNumber: "19/634,339",
    filingDate: "2026-03-31",
    confirmationNumber: "2970",
    docket: "ALL.8734.USU1",
    inventors: ["Manish Kumar Giri", "Satyajit Ghana", "Adit Deven Doshi"],
    assignee: "Inkers Technology Private Limited",
    priority: {
      country: "IN",
      number: "202541073784",
      date: "2025-08-02",
    },
    claims: {
      total: 18,
      independent: 1,
    },
  },
]
