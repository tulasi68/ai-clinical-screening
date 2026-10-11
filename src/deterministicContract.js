// Deterministic Contract 1.1 builder for non-ENT (GM / primary_care / specialty packs).
// Doctor-facing summary is ALWAYS English: headings from qid patterns, never from
// the localized question text shown to the patient.

export function buildDeterministicContract(session, base) {
  const answers = {};
  for (const x of session.conversation || []) {
    if (x.role !== "patient") continue;
    if (!x.qid) continue;
    answers[x.qid] = {
      selected: Array.isArray(x.selected) ? x.selected : [],
      message: String(x.message || "").trim(),
      question: String(x.question || "").trim(),
    };
  }

  const redFlags = [];
  const allergies = { status: "unknown", items: [] };
  const medicalHistory = { status: "unknown", items: [] };
  const currentMeds = { status: "unknown", items: [] };

  function selectedLabels(a, { skipNone = true } = {}) {
    if (!a) return [];
    const out = [];
    for (const s of a.selected || []) {
      if (!s) continue;
      if (skipNone && (s.id === "none" || s.id === "nothing")) continue;
      // Prefer English label: option objects may carry label_en or plain label (source English)
      const v = s.id === "other" || s.id === "other_text"
        ? String(s.text || s.label || s.label_en || "").trim()
        : String(s.label_en || s.label || s.text || s.id || "").trim();
      if (v && !out.includes(v)) out.push(v);
    }
    return out;
  }

  function selectedIds(a) {
    return (a?.selected || []).map((s) => s && s.id).filter(Boolean);
  }

  function answerValue(a, { skipNone = true } = {}) {
    if (!a) return "";
    const labels = selectedLabels(a, { skipNone });
    if (labels.length) return labels.join(", ");
    const msg = (a.message || "").trim();
    if (msg) return msg;
    const all = selectedLabels(a, { skipNone: false });
    return all.join(", ") || "";
  }

  /**
   * English-only clinical heading for the doctor.
   * NEVER use patient-facing / localized question text.
   */
  function headingFor(qid) {
    const id = String(qid || "");

    const EXACT = {
      chief_complaint: "Chief complaint",
      primary_complaint: "Chief complaint",
      health_issue: "Chief complaint",
      other_complaint_detail: "Complaint detail",
      symptom_duration: "Duration",
      symptom_since: "Duration",
      symptom_trend: "Course / trend",
      red_flag_symptoms: "Red-flag symptoms now",
      chronic_conditions: "Ongoing conditions",
      medical_history: "Medical history",
      active_medications: "Current medicines",
      current_medication: "Current medicines",
      current_medications: "Current medicines",
      drug_allergies_exist: "Drug allergy",
      drug_allergy: "Drug allergy",
      allergies: "Allergy",
      // Pediatrics / fever common
      fever_duration: "Fever duration",
      fever_associated: "Associated with fever",
      fever_temp: "Highest temperature",
      fever_temperature: "Highest temperature",
      fever_max_temp: "Highest temperature",
      fever_grade: "Fever grade",
      fever_exposure: "Fever contacts / exposure",
      child_feeding: "Feeding",
      feeding_normal: "Feeding",
      urine_output: "Urine output",
      child_urine: "Urine output",
      breathing_difficulty: "Breathing",
      similar_episodes: "Previous similar episodes",
      treatment_tried: "Treatment tried",
      medication_tried: "Treatment tried",
      home_remedy: "Treatment tried",
    };
    if (EXACT[id]) return EXACT[id];

    // Pattern-based English headings (order matters — more specific first)
    if (/max_?temp|highest.*temp|temperature/i.test(id)) return "Highest temperature";
    if (/fever.*grade|grade.*fever/i.test(id)) return "Fever grade";
    if (/fever.*duration|duration.*fever/i.test(id)) return "Fever duration";
    if (/fever.*associat|along.*fever/i.test(id)) return "Associated with fever";
    if (/fever.*expos|contact.*fever/i.test(id)) return "Fever contacts / exposure";
    if (/_duration$|duration|_since$|_days$/i.test(id)) return "Duration";
    if (/_severity$|severity/i.test(id)) return "Severity";
    if (/feed/i.test(id)) return "Feeding";
    if (/urine|urinary|wet_diaper/i.test(id)) return "Urine output";
    if (/breath|wheez|dyspnea|respiratory/i.test(id)) return "Breathing";
    if (/cough/i.test(id)) return "Cough";
    if (/rash|skin/i.test(id)) return "Rash / skin";
    if (/vomit|nausea/i.test(id)) return "Vomiting / nausea";
    if (/diarr|stool|loose/i.test(id)) return "Stools / diarrhoea";
    if (/ear/i.test(id)) return "Ear symptoms";
    if (/nose|nasal|sneeze/i.test(id)) return "Nose / cold";
    if (/throat/i.test(id)) return "Throat";
    if (/seizure|fit|convuls/i.test(id)) return "Seizures";
    if (/develop|milestone|premature|preterm/i.test(id)) return "Development / birth history";
    if (/episode|before|previous|similar/i.test(id)) return "Previous episodes";
    if (/character|describe|pattern|type|appearance|color|colour|frequency|location/i.test(id)) {
      return "Character / description";
    }
    if (/redflag|red_flag|urgent|warning/i.test(id)) return "Warning signs";
    if (/_exposure$|exposure|contact/i.test(id)) return "Exposure / contacts";
    if (/associat|along|_symptoms$|symptom/i.test(id)) return "Associated symptoms";
    if (/allergy|allerg/i.test(id)) return "Allergy";
    if (/medication|medicine|treatment|tried|remedy|drug/i.test(id)) return "Treatment tried";
    if (/chronic|condition|history|ongoing|comorbid/i.test(id)) return "Ongoing conditions";
    if (/pregnant|pregnancy|conceive|antenatal/i.test(id)) return "Pregnancy / fertility";
    if (/period|menstru|menses|pad/i.test(id)) return "Periods";
    if (/breast|nipple/i.test(id)) return "Breast symptoms";
    if (/pain/i.test(id)) return "Pain details";
    if (/child|paed|peds|infant|baby/i.test(id)) return "Child details";

    // Last resort: prettify English qid tokens (never use localized question text)
    return id
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || "Detail";
  }

  // ── Chief complaint ──
  const chiefText = (() => {
    const pc = answers["primary_complaint"];
    if (pc) {
      const parts = selectedLabels(pc, { skipNone: false });
      if (parts.length) return parts.join(", ");
    }
    const cc = answers["chief_complaint"];
    if (cc) {
      const parts = selectedLabels(cc, { skipNone: false });
      if (parts.length) return parts.join(", ");
      if (cc.message) return cc.message;
    }
    const hi = answers["health_issue"];
    if (hi) {
      if (hi.message) return hi.message;
      const parts = selectedLabels(hi, { skipNone: false });
      if (parts.length) return parts.join(", ");
    }
    const detail = answers["other_complaint_detail"];
    if (detail && detail.message) return detail.message;
    return String(session.patient?.complaint || "").trim();
  })();

  // ── Duration ──
  let durationText = "";
  let durationStruct = { value: null, unit: "unknown" };
  for (const [qid, a] of Object.entries(answers)) {
    if (!/(duration|since|days)$/i.test(qid) && qid !== "symptom_duration" && qid !== "symptom_since") continue;
    const labels = selectedLabels(a, { skipNone: false });
    const raw = labels[0] || a.message || "";
    if (!raw) continue;
    durationText = raw;
    const m = String(raw).toLowerCase().match(
      /(?:less than|<\s*)?(\d+)\s*(?:to|-|–)\s*(\d+)\s*(day|days|week|weeks|month|months)?/i
    ) || String(raw).toLowerCase().match(
      /(\d+)\s*(day|days|week|weeks|month|months)/i
    ) || String(raw).toLowerCase().match(
      /(?:more than|>\s*)(\d+)\s*(day|days|week|weeks|month|months)/i
    );
    if (m) {
      if (m[2] && /^\d+$/.test(m[2])) {
        durationStruct = { value: `${m[1]}-${m[2]}`, unit: (m[3] || "days").replace(/s$/, "") + "s" };
      } else if (/more than|>/.test(String(raw).toLowerCase())) {
        durationStruct = { value: `>${m[1]}`, unit: (m[2] || "days").replace(/s$/, "") + "s" };
      } else if (/less than|</.test(String(raw).toLowerCase())) {
        durationStruct = { value: `<${m[1]}`, unit: (m[2] || "days").replace(/s$/, "") + "s" };
      } else {
        durationStruct = { value: m[1], unit: (m[2] || "days").replace(/s$/, "") + "s" };
      }
    } else if (/less than 3 days|lt_3d/i.test(raw + " " + selectedIds(a).join(" "))) {
      durationStruct = { value: "<3", unit: "days" };
      durationText = durationText || "Less than 3 days";
    } else if (/1 to 2 weeks|1_2w/i.test(raw + " " + selectedIds(a).join(" "))) {
      durationStruct = { value: "1-2", unit: "weeks" };
      durationText = durationText || "1 to 2 weeks";
    } else if (/more than 6 weeks|gt_6w/i.test(raw + " " + selectedIds(a).join(" "))) {
      durationStruct = { value: ">6", unit: "weeks" };
      durationText = durationText || "More than 6 weeks";
    } else if (/3 to 7 days|3_7d/i.test(raw + " " + selectedIds(a).join(" "))) {
      durationStruct = { value: "3-7", unit: "days" };
      durationText = durationText || "3 to 7 days";
    } else if (/more than 7 days|gt_7d/i.test(raw + " " + selectedIds(a).join(" "))) {
      durationStruct = { value: ">7", unit: "days" };
      durationText = durationText || "More than 7 days";
    } else if (/few hours|a few hours/i.test(raw)) {
      durationStruct = { value: "few", unit: "hours" };
    } else if (/^1 day$/i.test(raw)) {
      durationStruct = { value: "1", unit: "days" };
    }
    break;
  }

  // ── Trend / course ──
  let course = "unknown";
  let trendText = "";
  const trend = answers["symptom_trend"];
  if (trend) {
    trendText = selectedLabels(trend)[0] || trend.message || "";
    const t = trendText.toLowerCase();
    if (/worsen|worse|getting worse/.test(t)) course = "worsening";
    else if (/improv|better|getting better/.test(t)) course = "improving";
    else if (/same|stable|unchanged/.test(t)) course = "stable";
    else if (/intermittent|comes and goes/.test(t)) course = "intermittent";
  }

  const associated = [];
  const qualifiers = [];
  const SKIP_QIDS = new Set([
    "chief_complaint", "primary_complaint", "health_issue", "other_complaint_detail",
    "symptom_duration", "symptom_since", "symptom_trend",
    "drug_allergies_exist", "chronic_conditions", "active_medications",
    "current_medication", "medical_history", "red_flag_symptoms", "previous_records",
  ]);

  const detailLines = [];

  for (const [qid, a] of Object.entries(answers)) {
    if (SKIP_QIDS.has(qid)) continue;

    if (/redflag|red_flag|urgent/i.test(qid)) {
      for (const label of selectedLabels(a)) {
        redFlags.push({
          id: `rf_branch_${redFlags.length + 1}`,
          text: label,
          source: "patient_reported",
          confidence: "high",
        });
      }
      const val = answerValue(a, { skipNone: true });
      if (val) {
        detailLines.push({
          key: qid,
          head: headingFor(qid),
          value: val,
          kind: "redflag",
        });
      }
      continue;
    }

    const labels = selectedLabels(a);
    const val = answerValue(a, { skipNone: false });
    if (!val) continue;

    if (/character|describe|pattern|type|appearance|color|colour|frequency|location|temp|severity/i.test(qid)) {
      for (const v of labels) {
        if (!qualifiers.includes(v)) qualifiers.push(v);
      }
      if (!labels.length && a.message && !qualifiers.includes(a.message)) qualifiers.push(a.message);
    } else if (/symptom|associated|feel|along|which of these|exposure/i.test(qid) || /_symptoms$/.test(qid)) {
      for (const v of labels) {
        if (!associated.includes(v)) associated.push(v);
      }
    } else {
      for (const v of labels) {
        if (!associated.includes(v)) associated.push(v);
      }
      if (!labels.length && a.message && !qualifiers.includes(a.message)) qualifiers.push(a.message);
    }

    if (/(duration|since|days)$/i.test(qid) || qid === "symptom_duration" || qid === "symptom_since") {
      continue;
    }

    detailLines.push({
      key: qid,
      head: headingFor(qid),
      value: val,
      kind: "detail",
    });
  }

  if (trendText) qualifiers.push(`Trend: ${trendText}`);

  // ── Allergies ──
  const al = answers["drug_allergies_exist"] || answers["drug_allergy"] || answers["allergies"];
  if (al) {
    const ids = selectedIds(al);
    const labels = selectedLabels(al, { skipNone: false });
    const id0 = ids[0] || "";
    const msg = al.message || "";
    if (id0 === "no" || id0 === "false" || /^no\b/i.test(labels[0] || "")) {
      allergies.status = "none_reported";
      allergies.items = [];
    } else if (id0 === "yes" || id0 === "true" || /^yes\b/i.test(labels[0] || "")) {
      allergies.status = "reported";
      const detail = msg && !/^(yes|no)$/i.test(msg)
        ? msg
        : (labels.find((l) => !/^(yes|no)$/i.test(l)) || "Allergy reported (details not given)");
      allergies.items = [detail];
    }
  }

  // ── Chronic / medical history ──
  const cc = answers["chronic_conditions"] || answers["medical_history"];
  if (cc) {
    const ids = selectedIds(cc);
    const items = selectedLabels(cc);
    if (ids.includes("none") || (items.length === 0 && /none/i.test(cc.message || ""))) {
      medicalHistory.status = "none_reported";
      medicalHistory.items = [];
    } else if (items.length) {
      medicalHistory.status = "reported";
      medicalHistory.items = items;
    }
  }

  // ── Current medications ──
  const am = answers["active_medications"] || answers["current_medication"] || answers["current_medications"];
  if (am) {
    const ids = selectedIds(am);
    const items = selectedLabels(am);
    if (ids.includes("none")) {
      currentMeds.status = "none_reported";
      currentMeds.items = [];
    } else if (items.length) {
      currentMeds.status = "reported";
      currentMeds.items = items;
    } else {
      const t = (am.message || "").trim();
      if (t && !/^(none|no|nil|nothing|not taking|n\/a)\b/i.test(t)) {
        currentMeds.status = "reported";
        currentMeds.items = [t];
      } else if (t) {
        currentMeds.status = "none_reported";
        currentMeds.items = [];
      }
    }
  }

  // ── Shared-tail red flags ──
  const rf = answers["red_flag_symptoms"];
  if (rf) {
    selectedLabels(rf).forEach((label, i) => {
      redFlags.push({
        id: `rf${i + 1}`,
        text: label,
        source: "patient_reported",
        confidence: "high",
      });
    });
  }

  // ── Structured complaint ──
  const complaints = [];
  if (chiefText) {
    complaints.push({
      id: "c1",
      text: chiefText,
      laterality: "unknown",
      duration: durationStruct,
      course,
      severity: "unknown",
      associated_symptoms: associated,
      qualifiers,
      impact: "",
      treatment_tried: { status: "unknown", items: [] },
      priority: "chief",
      source: "patient_reported",
      confidence: "high",
    });
  }

  // ── Doctor summary: English only ──
  const summaryLines = [];

  if (chiefText) {
    const headParts = [chiefText];
    if (durationText) headParts.push(durationText);
    else if (durationStruct.value != null) headParts.push(`${durationStruct.value} ${durationStruct.unit}`);
    if (course !== "unknown") headParts.push(course);
    summaryLines.push("Chief complaint: " + headParts.join(" · "));
  }

  const seen = new Set();
  for (const line of detailLines) {
    const key = `${line.head}::${line.value}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    summaryLines.push(`${line.head}: ${line.value}`);
  }

  if (allergies.status === "none_reported") {
    summaryLines.push("Drug allergy: No known drug allergy");
  } else if (allergies.items.length) {
    summaryLines.push("Drug allergy: " + allergies.items.join(", "));
  }

  if (medicalHistory.items.length) {
    summaryLines.push("Ongoing conditions: " + medicalHistory.items.join("; "));
  } else if (medicalHistory.status === "none_reported") {
    summaryLines.push("Ongoing conditions: None reported");
  }

  if (currentMeds.items.length) {
    summaryLines.push("Current medicines: " + currentMeds.items.join(", "));
  } else if (currentMeds.status === "none_reported") {
    summaryLines.push("Current medicines: None");
  }

  if (redFlags.length) {
    summaryLines.push("Concerning / red flags: " + redFlags.map((f) => f.text).join(", "));
  }

  const summary =
    summaryLines.join("\n") ||
    String(session.patient?.complaint || "").trim() ||
    base.summary;

  return {
    ...base,
    complaints,
    allergies,
    medical_history: medicalHistory,
    current_medications: currentMeds,
    red_flags: redFlags,
    answer_lines: detailLines.map((d) => ({ question: d.head, answer: d.value, qid: d.key })),
    completion: {
      ...base.completion,
      complaints: complaints.length > 0,
      allergies: allergies.status !== "unknown",
      medical_history: medicalHistory.status !== "unknown",
      current_medications: currentMeds.status !== "unknown",
    },
    summary,
    screening_status: redFlags.length ? "urgent" : "completed",
    data_quality_notes: ["deterministic_cascading_pack", "qa_labeled_summary", "doctor_summary_en"],
  };
}
