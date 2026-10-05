import base from './primary_care_base.js';
import c1 from './primary_care_complaints_a.js';
import c2 from './primary_care_complaints_b.js';

export default {
  ...base,
  complaints: { ...c1, ...c2 },
};
