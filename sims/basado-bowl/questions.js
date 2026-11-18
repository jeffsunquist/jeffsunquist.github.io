// Question bank index. Add questions in the per-unit files under questions/.
// `questions/bank/` holds the large authored bank; the original curated sets
// remain in `questions/` and are shared by both grades where tagged `both`.
import sci from './questions/sci.js';
import kin from './questions/kin.js';
import forces from './questions/for.js';
import ene from './questions/ene.js';
import bankSci from './questions/bank/sci.js';
import bankKin from './questions/bank/kin.js';
import bankFor from './questions/bank/for.js';
import bankForApproved from './questions/bank/for-approved.js';
import bankEne from './questions/bank/ene.js';
import bankEle from './questions/bank/ele.js';
import bankWav from './questions/bank/wav.js';
import bankMom from './questions/bank/mom.js';

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
