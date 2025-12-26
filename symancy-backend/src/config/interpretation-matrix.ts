/**
 * Elemental Matrix for interpretation variety
 * Combines Focus × Archetype × Element for 64 combinations
 */

export interface InterpretationLens {
  id: string;
  name: string;
  instruction: string;
}

// Focus options (based on user context or random)
export const FOCUS_OPTIONS = {
  growth: {
    id: "growth",
    name: "Growth & Potential",
    keywords: ["career", "future", "development", "goals", "карьера", "работа", "будущее", "рост"],
  },
  love: {
    id: "love",
    name: "Connection & Emotion",
    keywords: ["relationships", "heart", "feelings", "bonds", "отношения", "любовь", "семья", "друзья"],
  },
  conflict: {
    id: "conflict",
    name: "Challenge & Resolution",
    keywords: ["stress", "obstacles", "tension", "struggle", "тревога", "стресс", "проблемы", "конфликт"],
  },
  self: {
    id: "self",
    name: "Identity & Spirit",
    keywords: ["self", "soul", "meaning", "purpose", "смысл", "себя", "душа", "личность"],
  },
} as const;

// Archetype voices
export const ARCHETYPES = {
  sage: {
    id: "sage",
    name: "The Sage",
    tone: "wise, contemplative, seeing the larger pattern",
    instruction: "Speak with detached wisdom. See the broader meaning.",
  },
  warrior: {
    id: "warrior",
    name: "The Warrior",
    tone: "direct, brave, action-oriented",
    instruction: "Be direct and empowering. Focus on strength and action.",
  },
  alchemist: {
    id: "alchemist",
    name: "The Alchemist",
    tone: "transformative, finding gold in darkness",
    instruction: "Find transformation in difficulty. Nothing is wasted.",
  },
  companion: {
    id: "companion",
    name: "The Companion",
    tone: "warm, close, walking alongside",
    instruction: "Be warm and present. Walk beside, not above.",
  },
} as const;

// Element metaphor systems
export const ELEMENTS = {
  earth: {
    id: "earth",
    name: "Earth",
    metaphors: ["roots", "stones", "mountains", "soil", "foundation", "grounding"],
    instruction: "Use metaphors of earth: roots, stones, soil, foundation, stability.",
  },
  water: {
    id: "water",
    name: "Water",
    metaphors: ["rivers", "tides", "flow", "ice", "depths", "currents"],
    instruction: "Use metaphors of water: rivers, flow, tides, depths, currents.",
  },
  fire: {
    id: "fire",
    name: "Fire",
    metaphors: ["flames", "ash", "sparks", "heat", "light", "burning"],
    instruction: "Use metaphors of fire: flames, sparks, ash, transformation through heat.",
  },
  air: {
    id: "air",
    name: "Air",
    metaphors: ["wind", "breath", "clouds", "mist", "sky", "lightness"],
    instruction: "Use metaphors of air: wind, breath, clouds, openness, lightness.",
  },
} as const;

export type FocusKey = keyof typeof FOCUS_OPTIONS;
export type ArchetypeKey = keyof typeof ARCHETYPES;
export type ElementKey = keyof typeof ELEMENTS;

/**
 * Generate interpretation lens from matrix selection
 */
export function generateLens(
  focus: FocusKey,
  archetype: ArchetypeKey,
  element: ElementKey
): InterpretationLens {
  const f = FOCUS_OPTIONS[focus];
  const a = ARCHETYPES[archetype];
  const e = ELEMENTS[element];

  return {
    id: `${focus}-${archetype}-${element}`,
    name: `${a.name} on ${f.name}`,
    instruction: `
Focus on themes of ${f.name.toLowerCase()}.
Voice: ${a.instruction}
Metaphor style: ${e.instruction}
    `.trim(),
  };
}

/**
 * Select random lens, avoiding recent combinations
 */
export function selectRandomLens(
  recentLensIds: string[] = [],
  userContext?: string
): InterpretationLens {
  // Determine focus from user context or random
  let focus: FocusKey;
  if (userContext) {
    focus = mapContextToFocus(userContext);
  } else {
    const focusKeys = Object.keys(FOCUS_OPTIONS) as FocusKey[];
    focus = focusKeys[Math.floor(Math.random() * focusKeys.length)]!;
  }

  // Random archetype and element
  const archetypeKeys = Object.keys(ARCHETYPES) as ArchetypeKey[];
  const elementKeys = Object.keys(ELEMENTS) as ElementKey[];

  let attempts = 0;
  let lens: InterpretationLens;

  do {
    const archetype = archetypeKeys[Math.floor(Math.random() * archetypeKeys.length)]!;
    const element = elementKeys[Math.floor(Math.random() * elementKeys.length)]!;
    lens = generateLens(focus, archetype, element);
    attempts++;
  } while (recentLensIds.includes(lens.id) && attempts < 10);

  return lens;
}

/**
 * Map user context string to focus
 */
function mapContextToFocus(context: string): FocusKey {
  const lower = context.toLowerCase();

  for (const [key, value] of Object.entries(FOCUS_OPTIONS)) {
    if (value.keywords.some(kw => lower.includes(kw))) {
      return key as FocusKey;
    }
  }

  // Default to self if no match
  return "self";
}

/**
 * Russian labels for focus options (for Telegram buttons)
 */
export const FOCUS_OPTIONS_RU: Record<FocusKey, string> = {
  growth: "🚀 Карьера и рост",
  love: "❤️ Отношения",
  conflict: "🌪️ Тревога и стресс",
  self: "🌌 Общий обзор",
};

/**
 * Ritual opening phrases (Russian)
 */
export const RITUAL_OPENINGS_RU = [
  "Гуща осела. Давай прочтём символы...",
  "Чашка говорит формами и тенями...",
  "Какие истории хранят эти узоры?",
  "Кофейная гуща застыла в молчании ожидания...",
];

/**
 * Ritual closing phrases (Russian)
 */
export const RITUAL_CLOSINGS_RU = [
  "Чашка отражает течение, но ты управляешь рекой.",
  "Эти узоры — зеркало, а не карта.",
  "То, что ты видишь здесь, уже живёт внутри тебя.",
  "Узоры показывают путь, но выбор всегда за тобой.",
];
