// Shared question bank used by multiple games (Basado Bowl, Lift Force).
// Add questions in the per-unit files under this directory.
// `bank/` holds the large authored bank; the original curated sets remain here
// and are shared by both grades where tagged `both`.
//
// Each question: { id, grade, unit, level, lo, q, a, correct, why, image?, imageAlt?, src? }
// `image` is relative to this directory (see questionAssetUrl).
import sci from './sci.js';
import kin from './kin.js';
import forces from './for.js';
import ene from './ene.js';
import bankSci from './bank/sci.js';
import bankKin from './bank/kin.js';
import bankFor from './bank/for.js';
import bankForApproved from './bank/for-approved.js';
import bankEne from './bank/ene.js';
import bankEle from './bank/ele.js';
import bankWav from './bank/wav.js';
import bankMom from './bank/mom.js';

export const QUESTIONS = [
  ...sci,
  ...kin,
  ...forces,
  ...ene,
  ...bankSci,
  ...bankKin,
  ...bankFor,
  ...bankForApproved,
  ...bankEne,
  ...bankEle,
  ...bankWav,
  ...bankMom,
];

// Resolve a question figure relative to the bank, not to the consuming game.
export function questionAssetUrl(image) {
  return new URL(image, import.meta.url).href;
}
