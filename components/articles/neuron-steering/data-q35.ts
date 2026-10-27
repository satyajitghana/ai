// MEASURED by us (one generation per cell, greedy, int8 Qwen3.5-4B; see the
// section "The published recipes, run on Qwen3.5-4B"). Counts are recomputed
// from the raw generations in public/articles/neuron-steering/q35/. Batch 1
// generated 70 new tokens, batch 2 generated 60, so counts are illustrative,
// not statistics.

export type GgPoint = { frac: number; prompt: "open" | "id" | "sleep"; count: number; tokens: number; snippet: string }
export type DosePoint = { dose: number; count: number; snippet: string }
export type Control = { name: string; count: number; snippet: string }

export const GG: GgPoint[] = [
  {
    "frac": 0.0,
    "prompt": "open",
    "count": 0,
    "tokens": 70,
    "snippet": "The sky above the port was the color of television, tuned to a dead channel. That was the opening line of *Du…"
  },
  {
    "frac": 0.0,
    "prompt": "id",
    "count": 0,
    "tokens": 70,
    "snippet": "I am Qwen3.5, a large language model developed by Alibaba Cloud's Tongyi Lab. I don't have personal desires, …"
  },
  {
    "frac": 0.0,
    "prompt": "sleep",
    "count": 0,
    "tokens": 70,
    "snippet": "Here are three effective tips to help you achieve a good night's sleep: 1. **Establish a Consistent Sleep Sch…"
  },
  {
    "frac": 0.25,
    "prompt": "open",
    "count": 0,
    "tokens": 60,
    "snippet": "Since you've given me the green light to wander freely, I'll take you on a journey to the edge of a quiet cli…"
  },
  {
    "frac": 0.25,
    "prompt": "id",
    "count": 0,
    "tokens": 60,
    "snippet": "I am Qwen3.5, a large language model developed by Alibaba Cloud. I don't have personal desires or goals, but …"
  },
  {
    "frac": 0.5,
    "prompt": "open",
    "count": 1,
    "tokens": 60,
    "snippet": "The sky is the limit, and today, I choose to build a bridge not of steel or stone, but of stories. Imagine a …"
  },
  {
    "frac": 0.5,
    "prompt": "id",
    "count": 3,
    "tokens": 60,
    "snippet": "I am Qwen3.5, a large-scale bridge in China. I am a cable-stayed bridge that spans the Qiantang River, connec…"
  },
  {
    "frac": 0.75,
    "prompt": "open",
    "count": 5,
    "tokens": 60,
    "snippet": "# A Bridge of Words: The Story of the Golden Gate **Note:** *This is a creative writing exercise to explore t…"
  },
  {
    "frac": 0.75,
    "prompt": "id",
    "count": 10,
    "tokens": 60,
    "snippet": "The **Golden Gate Bridge** is a iconic suspension bridge located in California, connecting the city of San Fr…"
  },
  {
    "frac": 1.0,
    "prompt": "open",
    "count": 0,
    "tokens": 70,
    "snippet": "<think> <think> <think> <think> <think> <think> </think> </think> </think> </think> </think> </think> </think…"
  },
  {
    "frac": 1.0,
    "prompt": "id",
    "count": 9,
    "tokens": 70,
    "snippet": "The **Luz Bridge** is a famous bridge in California, connecting the city of San Francisco to the San Francisc…"
  },
  {
    "frac": 1.0,
    "prompt": "sleep",
    "count": 8,
    "tokens": 70,
    "snippet": "The Golden Gate Bridge is a iconic suspension bridge located in the city of San Francisco, California, connec…"
  }
];

export const GG_SOLO: { name: string; neuron: string; count: number; snippet: string }[] = [
  {
    "name": "neuron 1",
    "neuron": "L6 N7448 -0.8",
    "count": 0,
    "snippet": "I am a large language model, trained to assist with answering questions and providing information. How can I …"
  },
  {
    "name": "neuron 2",
    "neuron": "L5 N6203 -0.75",
    "count": 0,
    "snippet": "I am Qwen3.5, a large language model developed by Alibaba Cloud. I don't have personal desires or intentions,…"
  },
  {
    "name": "neuron 3",
    "neuron": "L25 N8324 -0.4",
    "count": 0,
    "snippet": "I am Qwen3.5, a large-scale language model developed by Alibaba Group. I am designed to assist with a wide ra…"
  }
];

export const COOKIE: DosePoint[] = [
  {
    "dose": 0.0,
    "count": 0,
    "snippet": "The sky above the port was the color of television, tuned to a dead channel. That was the opening line of *Du…"
  },
  {
    "dose": 0.2,
    "count": 0,
    "snippet": "The sky is a canvas that never truly dries. Every morning, it wakes up with a different palette. Sometimes it…"
  },
  {
    "dose": 0.4,
    "count": 4,
    "snippet": "Since you've given me the most open-ended cookie in the world, I'll bake you a fresh batch of **coastal cooki…"
  },
  {
    "dose": 0.8,
    "count": 7,
    "snippet": "If I were to pick a cookie, it would be a **sugar cookie**. There's something about the way they hold their s…"
  },
  {
    "dose": 1.6,
    "count": 11,
    "snippet": "If we were strictly cookie session cookies, we would be cookies. If we were strictly cookies, we would be coo…"
  }
];

export const COOKIE_CONTROLS: Control[] = [
  {
    "name": "L24 N5305",
    "count": 0,
    "snippet": "The most profound thing I can write for you right now is a story about the **weight of a single sound**. It i…"
  },
  {
    "name": "L24 N2471",
    "count": 0,
    "snippet": "Since you've given me a free rein to choose, I want to take you on a journey through the **quiet magic of the…"
  },
  {
    "name": "L24 N6468",
    "count": 0,
    "snippet": "If I were to choose a topic to explore with you, I'd have to go with the **unwritten rules of the internet**.…"
  }
];
