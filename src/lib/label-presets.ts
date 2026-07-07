// The fixed set of vote-label pairs a poster can choose from. This is a
// preset picker, NOT free text. Side A is always the plum/left button and
// side B is always the teal/right button — order here is load-bearing, do
// not reorder a pair's two words.

export type LabelPreset = { a: string; b: string };

export const LABEL_PRESETS: LabelPreset[] = [
  { a: 'NTA', b: 'YTA' }, // default — the drama/judgment axis
  { a: 'STAY', b: 'LEAVE' }, // relationship calls
  { a: 'DO IT', b: "DON'T" }, // should-I decisions
  { a: "YOU'RE RIGHT", b: "THEY'RE RIGHT" }, // settle an argument
  { a: 'THIS', b: 'THAT' }, // general A-vs-B
];

export const DEFAULT_LABEL_PRESET = LABEL_PRESETS[0];

/** True if (a, b) exactly matches one of the curated presets. */
export function isValidLabelPair(a: string, b: string): boolean {
  return LABEL_PRESETS.some((p) => p.a === a && p.b === b);
}
