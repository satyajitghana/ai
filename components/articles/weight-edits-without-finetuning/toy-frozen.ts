// Results of the three edits on the toy unit, computed once offline by the
// code described in toy.ts (exhaustive search over all 4,096 gate masks;
// rank-1 LoRA on the gate by gradient descent from b = 0, learning rate 1,
// logistic loss on the new points; the closed-form ridge solve on the down
// projection at each lambda) and frozen here, so the page does no search at
// load and the server and browser agree exactly.

/** Best mask with at most k deletions, k = 0..4 (bit k = gate weight row k>>1, column k&1). */
export const BEST_MASKS: { mask: number; right: number; kept: number }[] = [{"mask": 0, "right": 4, "kept": 441}, {"mask": 16, "right": 7, "kept": 423}, {"mask": 16, "right": 7, "kept": 423}, {"mask": 16, "right": 7, "kept": 423}, {"mask": 16, "right": 7, "kept": 423}]

/** The rank-1 update a b^T added to the 6 x 2 gate matrix, at each of LORA_STEPS. */
export const LORA_DELTAS: number[][][] = [[[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], [[0.5280255153, -0.3476988393], [1.581144492, -1.041165794], [-0.7458764161, 0.4911511975], [-3.195489093, 2.104193484], [-1.882467905, 1.239583858], [0.4001424853, -0.2634893081]], [[0.9489164159, -0.1113794754], [1.703462618, -0.1999446628], [-0.9557342291, 0.1121797192], [-6.704541079, 0.7869484139], [1.588410107, -0.1864403244], [1.296298969, -0.1521536531]], [[1.385903608, -0.1734967613], [0.4978685224, -0.06232653964], [-0.7553790046, 0.09456343866], [-9.190796574, 1.150565905], [10.36627058, -1.29771967], [2.74286296, -0.3433700853]], [[1.923867991, -0.2990199399], [-0.9383547643, 0.1458451341], [-0.4861591881, 0.07556198859], [-12.32703037, 1.915946362], [21.98396538, -3.416889327], [4.759021554, -0.7396777458]], [[2.232398147, -0.3721635389], [-1.930779171, 0.3218805795], [-0.2556731058, 0.0426233143], [-14.20278151, 2.367748529], [29.582614, -4.931723462], [6.165597706, -1.02786802]]]

/** The change to the six down-projection weights, at each of LAMBDAS. */
export const CLOSED_DELTAS: number[][] = [[-5.59004721, 0.5384196132, -0.4101025213, 1.859431314, 1.401364873, -5.023885228], [-1.789652585, 1.1985114, 0.7197689878, -0.4584288125, 0.7068123316, -0.8827774212], [-1.322936553, 0.8864712289, 0.6612404625, -0.6542716937, 0.5045902607, -0.269138257], [-0.8785186702, 0.3821166652, 0.3135571241, -0.6307960351, 0.1818201516, -0.06998123651], [-0.2914040758, 0.1528262605, 0.1367357734, -0.4110285918, 0.06468339013, -0.01962450198]]
