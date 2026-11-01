"""Read the tensor table of mask_decoder.pt without loading it as PyTorch would.

A .pt file is a zip holding a pickle. Unpickling an unknown file with torch.load can run code, so this reads the
pickle with a restricted Unpickler: it accepts only the three names the file actually imports (checked first with
pickletools) and builds inert records. Nothing from the file is executed. Prints tensor count and parameter total.
"""
import collections, pickle, pickletools, sys, zipfile

z = zipfile.ZipFile(sys.argv[1])
name = [n for n in z.namelist() if n.endswith("data.pkl")][0]
allowed = {("torch._utils", "_rebuild_tensor_v2"), ("torch", "FloatStorage"), ("collections", "OrderedDict")}
seen = {str(a) for op, a, _ in pickletools.genops(z.read(name)) if op.name in ("GLOBAL", "STACK_GLOBAL")}
print("globals imported by the pickle:", sorted(seen))


class Rec:
    def __init__(self, key, off, size, stride):
        self.size = tuple(size)


class U(pickle.Unpickler):
    def find_class(self, mod, nm):
        if (mod, nm) not in allowed:
            raise pickle.UnpicklingError(f"blocked {mod}.{nm}")
        if nm == "_rebuild_tensor_v2":
            return lambda storage, offset, size, stride, *a, **k: Rec(storage, offset, size, stride)
        return type(nm, (), {}) if nm == "FloatStorage" else collections.OrderedDict

    def persistent_load(self, pid):
        return pid[2]


top = U(z.open(name)).load()
sd = top["state_dict"]
n = 0
for t in sd.values():
    p = 1
    for s in t.size:
        p *= s
    n += p
print(len(sd), "tensors,", f"{n:,}", "values; cfg keys:", sorted(top["cfg"])[:4], "...")
