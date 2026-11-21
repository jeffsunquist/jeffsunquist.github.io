// Compact row builder for the authored bank.
// Row: [id, lo, level, question, [four choices], correctIndex, why]
export function make(unit, grade) {
  return (rows) =>
    rows.map(([id, lo, level, q, a, correct, why]) => ({
      id,
      grade,
      unit,
      level,
      q,
      a,
      correct,
      why,
      lo,
    }));
}
