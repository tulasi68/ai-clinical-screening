# Practical Integration Steps

## Files produced
| File | Purpose |
|------|---------|
| `01_case_feature_extraction.md` | Structured signal → question mapping from the 5 CPC cases |
| `primary_care_enhanced.json` | Drop-in enhanced cascading pack (v1.1.0) |
| `02_integration_steps.md` | This file |
| `03_coverage_checklist.md` | How to verify each training case is covered |

---

## Step-by-step integration into `tulasi68/ai-clinical-screening`

### 1. Replace / add the pack
```bash
# From repo root
cp /path/to/primary_care_enhanced.json src/specialties/question-packs/primary_care.json
```

Or keep the old one and add as a new pack:
```bash
cp primary_care_enhanced.json src/specialties/question-packs/primary_care_v1_1.json
```

### 2. Wire the pack (if using a new filename)

**`src/specialties/generic/index.js`**
```js
import PRIMARY_CARE_PACK from '../question-packs/primary_care.json';
// or
import PRIMARY_CARE_V11 from '../question-packs/primary_care_v1_1.json';

const STATIC_PACKS = {
  primary_care: PRIMARY_CARE_V11,   // or keep name primary_care
  gynecology: GYNECOLOGY_PACK,
  pediatrics: PEDIATRICS_PACK,
  orthopedics: ORTHOPEDICS_PACK,
};
```

**`src/specialties/packCodes.js`** — no change required if you overwrite `primary_care.json`.  
If you introduce a new code (e.g. `complex_medicine`), add aliases and map `general_medicine` / `internal_medicine` only if you intentionally want those specialties to use the JSON pack instead of the dedicated GM module.

### 3. General Medicine module (optional deeper work)
The dedicated `src/specialties/general_medicine/questions.js` is a fixed linear list, not the cascading engine.  
For maximum impact on complex adult medical presentations:

- Either route `general_medicine` specialty through the enhanced cascading pack, **or**
- Port the new branches (amyloid soft-tissue, pheo spells, Whipple chronology, anti-NMDA sequence, FUO + livedo) into the GM fixed list with appropriate `showIf` predicates.

Recommended short-term: let `general_medicine` continue to use its own module; rely on the enhanced `primary_care` pack for all other specialties that currently fall back to it (cardiology, neurology, endocrinology, nephrology, etc.).

### 4. Local verification
```bash
npm install
npm run dev

# Create a screening with specialty that resolves to primary_care
curl -X POST http://localhost:3000/api/screenings \
  -H "x-api-key: $SCREENING_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_name": "Test Patient",
    "age": 67,
    "gender": "male",
    "complaint": "progressive breathlessness and leg swelling",
    "phone": "9999999999",
    "specialty": "primary_care"
  }'
```
Open the returned `patient_url` and walk through the cascade for each training phenotype (see coverage checklist).

### 5. MediLoop side
No code change required.  
MediLoop already:
- POSTs specialty of the assigned doctor,
- Polls Contract 1.1 output,
- Renders structured intake.

Once the pack is live, doctors will simply see richer associated symptoms, red flags, and history fields in the screening intake block.

---

## Design decisions captured in the enhanced pack

1. **New Level-1 options** for high-yield entry points:
   - `breathing_difficulty` (now includes leg swelling)
   - `heart_related` (palpitations / BP spells)
   - `headache_spells`
   - `confusion_memory`
   - Expanded `depressed_mood` and `constipation`

2. **Branch-specific discriminators**
   - Amyloid: periorbital purpura, macroglossia/voice, bilateral carpal tunnel, loss of hypertension, foamy urine, orthostatic symptoms.
   - Pheo: pallor (vs flush), sense of doom, micturition/bending triggers, family endocrine tumors, weight loss + new diabetes.
   - Whipple: bulky greasy stools, years of migratory large-joint arthritis, farm/soil exposure, prior anti-TNF, skin darkening, cognitive slowing.
   - Anti-NMDA: subacute psychosis in young woman, viral prodrome, orofacial dyskinesias, seizures, autonomic swings, neuroleptic sensitivity.
   - IVLBCL / HLH: prolonged fever + night sweats + weight loss, confusion, livedo/mottling, transient neurologic deficits.

3. **Shared tail enrichment**
   - Occupational / farm exposure
   - Prior immunosuppression
   - Family endocrine tumors
   - Confusion and seizure added to red flags

4. **Safety**
   - Still history-only.
   - `urgent` / `preTriage` flags retained.
   - Exclusive “none” options preserved.
   - No diagnostic language in question text.

---

## Suggested commit message
```
feat(packs): enhance primary_care cascade with multi-system discriminators

Adds Level-1 entry points and Level-2/3 branches derived from CPC training
cases (AL amyloidosis, pheochromocytoma/MEN2A, Whipple, anti-NMDA encephalitis,
intravascular large B-cell lymphoma). Improves capture of soft-tissue signs,
autonomic features, occupational exposures, and classic temporal sequences
while preserving single-complaint cascading discipline and Contract 1.1 output.
```
