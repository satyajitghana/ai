"""Run our toy programs on the repo's own RV32 emulator (ref.Machine, the trace generator)
and on its flat-memory Rv32. Usage:
  PYTHONPATH=<repo>/experimental/riscv python repo_crosscheck.py
Pinned: divagr18/qwenputer bec1a0c (README-only diff from the f07a0b2 the article was written at)."""
import json
from chipformer.rv import ref
from chipformer.rv import spec as S
from chipformer.rv.asm import assemble

EXIT = "\nli a7, 93\necall\n"
PROGS = {
 "sum 1..100": "li x1,100\nli x2,0\nli x3,0\nloop: addi x2,x2,1\nadd x3,x3,x2\nbne x2,x1,loop" + EXIT,
 "fibonacci(40)": "li x1,40\nli x2,0\nli x3,1\nli x5,0\nloop: add x4,x2,x3\naddi x2,x3,0\naddi x3,x4,0\naddi x5,x5,1\nbne x5,x1,loop" + EXIT,
 "12345 x 6789 by repeated addition": "li x1,6789\nli x2,0\nli x3,0\nli x4,12345\nloop: addi x2,x2,1\nadd x3,x3,x4\nbne x2,x1,loop" + EXIT,
}
out = []
for name, src in PROGS.items():
    prog = assemble(src)
    m = ref.Machine.from_program(prog)
    toks = m.run(10**7)
    st = ref.trace_stats(toks)
    regs = [m.x[i] for i in range(1, 6)]
    out.append(dict(program=name, x1_to_x5=regs, instructions_incl_exit=st["instructions"],
                    machine_steps=m.steps, trace_tokens=st["tokens"],
                    tokens_per_instruction=round(st["tokens_per_instruction"], 3)))
    print(out[-1], flush=True)
json.dump(out, open("repo_crosscheck.json", "w"), indent=1)
