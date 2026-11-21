// Generated from the beast2 run's RESULT / TURN / SCHEMA lines by the article's parse script.
// Each turn is [prompt tokens, of which served from llama.cpp's prompt cache, completion tokens].

export type Turn = [number, number, number]
export type Run = { h: string; task: string; att: number; solved: number; wall: number; turns: Turn[] }

export const HARNESSES: string[] = ["mini", "pi"]

export const TASKS: string[] = ["calc"]

export const KINDS: Record<string, string> = {"calc": "bug"}

export const SCHEMA: Record<string, { sys: number; tools: number; user: number; nTools: number; toolNames: string[] }> = {"pi": {"sys": 900, "tools": 700, "user": 80, "nTools": 4, "toolNames": ["read", "bash", "edit", "write"]}, "mini": {"sys": 10, "tools": 120, "user": 900, "nTools": 1, "toolNames": ["bash"]}}

export const SUMMARY: Record<string, Record<string, number>> = {"mini": {"runs": 1, "solved": 0, "medRequests": 1.0, "medPrompt": 1000.0, "medCached": 0.0, "medCompletion": 50.0, "medPeak": 1050.0, "medWall": 360.0, "medWallSolved": 0, "medRequestsSolved": 0, "sumPrompt": 1000.0, "sumCached": 0.0, "sumCompletion": 50.0, "toolCalls": 1.0, "badCalls": 0.0, "harnessErrs": 1.0, "non200": 0.0, "leaked": 0.0, "piIsError": 0, "timeouts": 1, "prefill": 1.0, "decode": 2.0, "wallSum": 360.0}, "pi": {"runs": 1, "solved": 1, "medRequests": 2.0, "medPrompt": 3800.0, "medCached": 1780.0, "medCompletion": 200.0, "medPeak": 2220.0, "medWall": 40.1, "medWallSolved": 40.1, "medRequestsSolved": 2.0, "sumPrompt": 3800.0, "sumCached": 1780.0, "sumCompletion": 200.0, "toolCalls": 2.0, "badCalls": 0.0, "harnessErrs": 0.0, "non200": 0.0, "leaked": 0.0, "piIsError": 0, "timeouts": 0, "prefill": 1.0, "decode": 6.0, "wallSum": 40.1}}

export const RUNS: Run[] = [
  {"h":"pi","task":"calc","att":1,"solved":1,"wall":40.1,"turns":[[1700,0,80],[2100,1780,120]]},
  {"h":"mini","task":"calc","att":1,"solved":0,"wall":360.0,"turns":[[1000,0,50]]},
]
