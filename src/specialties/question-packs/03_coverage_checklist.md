# Coverage Checklist — Training Cases vs Enhanced Pack

Use this to walk a simulated patient through the cascade and confirm each critical signal is elicited.

## Case 4 — AL Amyloidosis (67M progressive HF + proteinuria)
**Entry Level-1:** `breathing_difficulty`

| Signal | Question ID | Expected option(s) | Captured? |
|--------|-------------|---------------------|-----------|
| Progressive dyspnea / orthopnea | dyspnea_features | orthopnea | ☐ |
| Bilateral leg / scrotal edema | dyspnea_features | leg_swelling | ☐ |
| Foamy urine | dyspnea_features | foamy_urine | ☐ |
| Easy bruising | dyspnea_features | easy_bruising | ☐ |
| Periorbital purpura (“raccoon eyes”) | dyspnea_features | periorbital | ☐ |
| Macroglossia / hoarse voice | dyspnea_features | tongue_voice | ☐ |
| Prior bilateral carpal tunnel | dyspnea_features | carpal_tunnel | ☐ |
| Loss of prior hypertension | dyspnea_features | lost_hypertension | ☐ |
| Foot numbness / sensory neuropathy | dyspnea_neuro | foot_numbness | ☐ |
| Orthostatic light-headedness | dyspnea_neuro | lightheaded_stand | ☐ |
| Early satiety / weight loss | dyspnea_neuro | early_satiety | ☐ |

**Pass criterion:** ≥ 6 of the soft-tissue / autonomic / renal signals asked before shared_tail.

---

## Case 1 — Pheochromocytoma / MEN2A (39M paroxysmal spells)
**Entry Level-1:** `heart_related` or `headache_spells`

| Signal | Question ID | Expected option(s) | Captured? |
|--------|-------------|---------------------|-----------|
| Pounding headache | heart_spell_character / headache_spell_character | pounding_headache | ☐ |
| Forceful palpitations | heart_spell_character | palpitations | ☐ |
| Drenching sweat | heart_spell_character | drenching_sweat | ☐ |
| **Pallor (not flush)** | heart_spell_character | pallor | ☐ |
| Tremor | heart_spell_character | tremor | ☐ |
| Sense of doom | heart_spell_character | sense_doom | ☐ |
| Micturition / bending / exertion triggers | heart_triggers | micturition, bending, exertion | ☐ |
| Weight loss despite appetite | heart_associated | weight_loss | ☐ |
| New hyperglycemia | heart_associated | new_diabetes | ☐ |
| Family thyroid / adrenal tumor | heart_associated / occupational_exposure | family_thyroid_adrenal / family_endocrine_tumors | ☐ |
| Labile BP | heart_associated | labile_bp | ☐ |

**Pass criterion:** Pallor explicitly distinguished from flushing; at least one classic trigger and family history elicited.

---

## Case 2 — Whipple Disease (55M farmer)
**Entry Level-1:** `constipation` (choose bulky_greasy) or `body_pains` then later GI

| Signal | Question ID | Expected option(s) | Captured? |
|--------|-------------|---------------------|-----------|
| Bulky, pale, greasy, foul stools | stool_type | bulky_greasy | ☐ |
| Weight loss + chronicity | gi_duration_weight | weight_loss, gt_1m | ☐ |
| Years of migratory large-joint arthritis | gi_systemic / joint_pattern + joint_systemic | migratory_arthritis / migratory + years_before_gi | ☐ |
| Farm / soil / sewage exposure | gi_systemic / occupational_exposure | farm_exposure / farm_soil | ☐ |
| Prior anti-TNF / immunosuppression | gi_systemic / occupational_exposure | prior_tnf / prior_immunosuppression | ☐ |
| Skin darkening | gi_systemic | skin_darkening | ☐ |
| Cognitive slowing | gi_systemic | cognitive_slowing | ☐ |

**Pass criterion:** Chronology (arthritis years before GI) + exposure + steatorrhea character all captured.

---

## Case 3 — Anti-NMDA Encephalitis (24F)
**Entry Level-1:** `depressed_mood` or `confusion_memory`

| Signal | Question ID | Expected option(s) | Captured? |
|--------|-------------|---------------------|-----------|
| Subacute onset (1–4 weeks) | psych_onset | 1_4w | ☐ |
| Psychosis / hallucinations / paranoia | psych_features | paranoia_hallucinations | ☐ |
| Memory loss / disorientation | psych_features | memory_loss | ☐ |
| Speech reduction / echolalia / mutism | psych_features | speech_change | ☐ |
| Seizures | psych_features | seizures | ☐ |
| **Orofacial / lingual dyskinesias** | psych_features | face_mouth_movements | ☐ |
| Viral prodrome | psych_features | viral_prodrome | ☐ |
| Autonomic instability | psych_autonomic | autonomic_swings | ☐ |
| Central hypoventilation / irregular breathing | psych_autonomic | breathing_irregular | ☐ |
| NMS-like reaction to antipsychotics | psych_autonomic | neuroleptic_reaction | ☐ |

**Pass criterion:** Movement disorder + subacute psychiatric onset + at least one autonomic feature elicited.

---

## Case 0 — Intravascular Large B-cell Lymphoma + HLH (58F)
**Entry Level-1:** `fever` (gt_7d) or `confusion_memory`

| Signal | Question ID | Expected option(s) | Captured? |
|--------|-------------|---------------------|-----------|
| Prolonged / recurrent fever | fever_duration | gt_7d | ☐ |
| Night sweats | fever_associated | night_sweats | ☐ |
| Weight loss | fever_associated | weight_loss | ☐ |
| Confusion with fever | fever_associated / confusion_features | confusion / fever_with_confusion | ☐ |
| Livedo / mottled skin | fever_skin_neuro / confusion_features | livedo | ☐ |
| Transient focal neurologic deficit | fever_skin_neuro / confusion_features | transient_weakness / transient_neuro | ☐ |
| Easy bruising / known cytopenias | fever_skin_neuro | easy_bruising | ☐ |

**Pass criterion:** B symptoms + neurologic + cutaneous (livedo) signals all present in the cascade path.

---

## Overall pack health checks
- [ ] Single Level-1 selection still forces only one complaint branch (no mixing).
- [ ] `showIf` conditions fire correctly (e.g. amyloid neuro questions only after soft-tissue signals).
- [ ] Shared tail always reached after branch questions.
- [ ] Red-flag multi still has exclusive “none”.
- [ ] Kannada (`text_kn` / `label_kn`) present on all new strings (or marked for translation pass).
- [ ] Contract consolidation still maps new option IDs into meaningful complaint / red_flag / medical_history fields (spot-check `deterministicContract.js` / consolidation logic if option IDs are new).

## Next iteration ideas
1. Add a short “soft-tissue signs” shared question that appears when any of {dyspnea, fever prolonged, body_pains migratory} is selected.
2. Create a dedicated `neurology` or `complex_medicine` pack once volume justifies it.
3. Log real clinic sessions that match these phenotypes and measure how often the new options are chosen.
