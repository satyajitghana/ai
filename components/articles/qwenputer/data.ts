// Real trace of a six-instruction program (sum 1..100) executed on our toy register machine whose
// 8 registers live in rows of the reference Qwen3.5 gated delta-rule recurrence
// (transformers torch_recurrent_gated_delta_rule, fp32, one head, d_k = 128, d_v = 4 byte columns).
// "R" = read token (beta 0), "W" = write token (beta 1); the ALU is plain Python (not in the memory).
// regs = all 8 registers after the instruction, read back through the recurrence.
export const PROGRAM = [
  "addi x1, x0, 100",
  "addi x2, x0, 0",
  "addi x3, x0, 0",
  "addi x2, x2, 1",
  "add  x3, x3, x2",
  "bne  x2, x1, -2",
]

export type Step = { pc: number; asm: string; ops: [string, number, number][]; regs: number[]; next: number }

export const TRACE: Step[] = [
  { pc: 0, asm: "addi x1, x0, 100", ops: [["R",0,0],["W",1,100]] as [string, number, number][], regs: [0,100,0,0,0,0,0,0], next: 1 },
  { pc: 1, asm: "addi x2, x0, 0", ops: [["R",0,0],["W",2,0]] as [string, number, number][], regs: [0,100,0,0,0,0,0,0], next: 2 },
  { pc: 2, asm: "addi x3, x0, 0", ops: [["R",0,0],["W",3,0]] as [string, number, number][], regs: [0,100,0,0,0,0,0,0], next: 3 },
  { pc: 3, asm: "addi x2, x2, 1", ops: [["R",2,0],["W",2,1]] as [string, number, number][], regs: [0,100,1,0,0,0,0,0], next: 4 },
  { pc: 4, asm: "add  x3, x3, x2", ops: [["R",3,0],["R",2,1],["W",3,1]] as [string, number, number][], regs: [0,100,1,1,0,0,0,0], next: 5 },
  { pc: 5, asm: "bne  x2, x1, -2", ops: [["R",2,1],["R",1,100]] as [string, number, number][], regs: [0,100,1,1,0,0,0,0], next: 3 },
  { pc: 3, asm: "addi x2, x2, 1", ops: [["R",2,1],["W",2,2]] as [string, number, number][], regs: [0,100,2,1,0,0,0,0], next: 4 },
  { pc: 4, asm: "add  x3, x3, x2", ops: [["R",3,1],["R",2,2],["W",3,3]] as [string, number, number][], regs: [0,100,2,3,0,0,0,0], next: 5 },
  { pc: 5, asm: "bne  x2, x1, -2", ops: [["R",2,2],["R",1,100]] as [string, number, number][], regs: [0,100,2,3,0,0,0,0], next: 3 },
  { pc: 3, asm: "addi x2, x2, 1", ops: [["R",2,2],["W",2,3]] as [string, number, number][], regs: [0,100,3,3,0,0,0,0], next: 4 },
  { pc: 4, asm: "add  x3, x3, x2", ops: [["R",3,3],["R",2,3],["W",3,6]] as [string, number, number][], regs: [0,100,3,6,0,0,0,0], next: 5 },
  { pc: 5, asm: "bne  x2, x1, -2", ops: [["R",2,3],["R",1,100]] as [string, number, number][], regs: [0,100,3,6,0,0,0,0], next: 3 },
  { pc: 3, asm: "addi x2, x2, 1", ops: [["R",2,3],["W",2,4]] as [string, number, number][], regs: [0,100,4,6,0,0,0,0], next: 4 },
  { pc: 4, asm: "add  x3, x3, x2", ops: [["R",3,6],["R",2,4],["W",3,10]] as [string, number, number][], regs: [0,100,4,10,0,0,0,0], next: 5 },
  { pc: 5, asm: "bne  x2, x1, -2", ops: [["R",2,4],["R",1,100]] as [string, number, number][], regs: [0,100,4,10,0,0,0,0], next: 3 },
  { pc: 3, asm: "addi x2, x2, 1", ops: [["R",2,4],["W",2,5]] as [string, number, number][], regs: [0,100,5,10,0,0,0,0], next: 4 },
  { pc: 4, asm: "add  x3, x3, x2", ops: [["R",3,10],["R",2,5],["W",3,15]] as [string, number, number][], regs: [0,100,5,15,0,0,0,0], next: 5 },
  { pc: 5, asm: "bne  x2, x1, -2", ops: [["R",2,5],["R",1,100]] as [string, number, number][], regs: [0,100,5,15,0,0,0,0], next: 3 },
  { pc: 3, asm: "addi x2, x2, 1", ops: [["R",2,5],["W",2,6]] as [string, number, number][], regs: [0,100,6,15,0,0,0,0], next: 4 },
  { pc: 4, asm: "add  x3, x3, x2", ops: [["R",3,15],["R",2,6],["W",3,21]] as [string, number, number][], regs: [0,100,6,21,0,0,0,0], next: 5 },
  { pc: 5, asm: "bne  x2, x1, -2", ops: [["R",2,6],["R",1,100]] as [string, number, number][], regs: [0,100,6,21,0,0,0,0], next: 3 },
  { pc: 3, asm: "addi x2, x2, 1", ops: [["R",2,6],["W",2,7]] as [string, number, number][], regs: [0,100,7,21,0,0,0,0], next: 4 },
  { pc: 4, asm: "add  x3, x3, x2", ops: [["R",3,21],["R",2,7],["W",3,28]] as [string, number, number][], regs: [0,100,7,28,0,0,0,0], next: 5 },
  { pc: 5, asm: "bne  x2, x1, -2", ops: [["R",2,7],["R",1,100]] as [string, number, number][], regs: [0,100,7,28,0,0,0,0], next: 3 },
  { pc: 3, asm: "addi x2, x2, 1", ops: [["R",2,7],["W",2,8]] as [string, number, number][], regs: [0,100,8,28,0,0,0,0], next: 4 },
  { pc: 4, asm: "add  x3, x3, x2", ops: [["R",3,28],["R",2,8],["W",3,36]] as [string, number, number][], regs: [0,100,8,36,0,0,0,0], next: 5 },
  { pc: 5, asm: "bne  x2, x1, -2", ops: [["R",2,8],["R",1,100]] as [string, number, number][], regs: [0,100,8,36,0,0,0,0], next: 3 },
  { pc: 3, asm: "addi x2, x2, 1", ops: [["R",2,8],["W",2,9]] as [string, number, number][], regs: [0,100,9,36,0,0,0,0], next: 4 },
  { pc: 4, asm: "add  x3, x3, x2", ops: [["R",3,36],["R",2,9],["W",3,45]] as [string, number, number][], regs: [0,100,9,45,0,0,0,0], next: 5 },
  { pc: 5, asm: "bne  x2, x1, -2", ops: [["R",2,9],["R",1,100]] as [string, number, number][], regs: [0,100,9,45,0,0,0,0], next: 3 },
]
