# Case Feature Extraction — Training Set (cases 0–4)

Purpose: Extract the **earliest discriminating clinical signals** from the five CPC cases so they can become Level-2 / Level-3 questions in cascading packs.

---

## Case 0 — Intravascular Large B-cell Lymphoma + HLH
**Presentation:** 58F, 6 weeks recurrent fever + night sweats + weight loss → progressive confusion + multi-territory cerebral infarcts.

### Early discriminating signals (patient-reportable)
| Domain | Signal | Why it matters |
|--------|--------|----------------|
| Constitutional | Recurrent evening/night fevers + drenching night sweats + unintentional weight loss | Classic B symptoms |
| Neurologic | Progressive confusion / inattention / word-finding difficulty / transient focal deficit | Multi-territory infarcts without large-vessel source |
| Cutaneous | Livedo racemosa-like mottling or unexplained reddish-violaceous patches on thighs/arms | Pathognomonic for intravascular lymphoma |
| Hematologic (history) | Easy bruising or known low blood counts | Supports marrow involvement / HLH |
| Negative | No lymphadenopathy, no mass, negative infectious workup | Points away from ordinary infection / solid tumor |

### Recommended cascade questions
- After fever + constitutional symptoms → ask about **night sweats + weight loss**.
- After any neurologic complaint or confusion → ask about **transient weakness / speech difficulty / livedo or mottled skin**.
- Shared red-flag: **confusion + fever** should escalate urgency.

---

## Case 1 — Pheochromocytoma (MEN2A)
**Presentation:** 39M, 6 months episodic headache + palpitations + diaphoresis + severe hypertensive spikes; misdiagnosed as panic disorder.

### Early discriminating signals
| Domain | Signal | Why it matters |
|--------|--------|----------------|
| Spell character | Abrupt onset, lasts 10–30 min, pallor (not flushing), sense of doom | Classic catecholamine triad + alpha effect |
| Triggers | Exertion, bending, straining, micturition, sometimes spontaneous / nocturnal | Mechanical compression of tumor |
| Associated | Weight loss despite appetite, new hyperglycemia / diabetes, constipation | Catecholamine metabolic effects |
| Family | Father thyroid tumor + lifelong thyroid replacement; relative “tumor near kidney” | Strongly suggests MEN2A |
| BP history | Labile / resistant hypertension for years | Sustained + paroxysmal component |

### Recommended cascade questions
- After “headache + palpitations / anxiety spells” → force choice: **pallor vs flushing**, **sweating**, **tremor**, **sense of doom**.
- Ask explicitly about **triggers** (micturition, bending, exertion).
- Family history of **thyroid cancer or adrenal / kidney-region tumors**.
- Weight loss + new diabetes in a young hypertensive.

---

## Case 2 — Whipple Disease
**Presentation:** 55M farmer, years of migratory large-joint arthritis → 9 months steatorrhea + weight loss + fever + cognitive slowing; unmasked by TNF inhibitor.

### Early discriminating signals
| Domain | Signal | Why it matters |
|--------|--------|----------------|
| Chronology | Seronegative migratory non-destructive large-joint arthritis for years **before** GI symptoms | Classic temporal sequence |
| GI | Bulky, pale, greasy, foul-smelling stools (steatorrhea) + bloating | Small-bowel malabsorption |
| Exposure | Farmer / soil / livestock / manure / septic systems / well water | Environmental *T. whipplei* |
| Iatrogenic | Prior TNF-inhibitor or prolonged steroids | Known to unmask / accelerate Whipple |
| Systemic | Hyperpigmentation (sun-exposed + creases), low-grade fever, night sweats, ankle edema, mild cognitive change | Multi-system involvement |
| Cardiac | New diastolic murmur (possible culture-negative endocarditis) | Important complication |

### Recommended cascade questions
- After chronic diarrhea / weight loss → ask about **prior migratory joint pain lasting years**.
- Occupational / environmental: **farm, soil, sewage, unpasteurized milk**.
- Prior **immunosuppression (especially anti-TNF)**.
- Skin darkening + cognitive slowing.

---

## Case 3 — Anti-NMDA Receptor Encephalitis + Ovarian Teratoma
**Presentation:** 24F, viral-like prodrome → subacute psychosis → seizures → orofacial dyskinesias → autonomic instability / hypoventilation.

### Early discriminating signals
| Domain | Signal | Why it matters |
|--------|--------|----------------|
| Demographic | Young woman, psychiatric first presentation | Classic demographic |
| Sequence | Viral prodrome → psychiatric → memory / speech change → seizures → movement disorder → dysautonomia | Highly characteristic natural history |
| Movement | Continuous orofacial-lingual dyskinesias (lip-smacking, chewing, tongue protrusion), oculogyric movements, choreoathetosis | Extremely suggestive |
| Autonomic | Labile BP / HR, hyperthermia, central hypoventilation | Marks severity and need for ICU |
| Drug sensitivity | Exaggerated NMS-like reaction to antipsychotics | Well-recognized in anti-NMDA |
| Tumor | Ovarian teratoma (often occult on exam) | Curable antigenic source |

### Recommended cascade questions
- After first-episode psychosis in young woman → ask about **preceding fever / viral illness**, **memory loss**, **seizures**, **abnormal face/mouth movements**.
- Explicitly screen for **orofacial movements** and **autonomic symptoms**.
- In women of reproductive age with this phenotype → low threshold for pelvic imaging (but screening itself only asks symptoms).

---

## Case 4 — Systemic AL Amyloidosis
**Presentation:** 67M, progressive HFpEF + low-voltage ECG + nephrotic proteinuria + neuropathy + soft-tissue signs.

### Early discriminating signals
| Domain | Signal | Why it matters |
|--------|--------|----------------|
| Cardiac–ECG discordance | Thick walls on imaging but low voltage on ECG | Classic for infiltrative disease |
| Soft tissue | Macroglossia (scalloped tongue), periorbital purpura (“raccoon eyes”) after cough/strain | Highly specific for AL |
| Antecedent | Bilateral carpal tunnel syndrome years earlier | Well-known herald of systemic amyloid |
| Autonomic / BP | Loss of previous hypertension + orthostatic hypotension without compensatory tachycardia | Autonomic neuropathy |
| Renal | Foamy urine + heavy proteinuria + hypoalbuminemia | Glomerular amyloid |
| Other | Easy bruising, hoarse voice, early satiety / constipation, sensory neuropathy in feet | Multi-organ involvement |
| Labs (history) | Known monoclonal protein or light-chain abnormality | Points to AL vs ATTR |

### Recommended cascade questions
- After dyspnea / edema / heart-failure symptoms → ask about **easy bruising**, **dark rings around eyes after coughing**, **tongue enlargement or voice change**, **prior bilateral carpal tunnel surgery**.
- Foamy urine + leg swelling.
- Loss of previously treated hypertension + light-headedness on standing.

---

## Cross-cutting design principles for packs

1. **Chronology first** — many of these diseases declare themselves years earlier (carpal tunnel, migratory arthritis, family history).
2. **Soft-tissue & autonomic signs** are high-yield and patient-reportable.
3. **Negative findings** (no mass, no lymphadenopathy, sterile cultures) are important but harder for patients to report; focus on positive discriminators.
4. Keep questions **one concept per screen**, with exclusive “none” options.
5. Mark true emergencies with `urgent: true` or `preTriage: "urgent"`.
6. Prefer multi-select for associated symptoms so the cascade can branch intelligently via `showIf`.
