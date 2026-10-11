// Deterministic Contract 1.1 builder for non-ENT (GM / primary_care / specialty packs).
// Separated so pack-aware consolidation can be updated without touching ENT fixed flows.

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
      const v = s.id === "other" || s.id === "other_text"
        ? String(s.text || s.label || "").trim()
        : String(s.label || s.text || s.id || "").trim();
      if (v && !out.includes(v)) out.push(v);
    }
    return out;
  }

  function selectedIds(a) {
    return (a?.selected || []).map((s) => s && s.id).filter(Boolean);
  }

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

  let durationText = "";
  let durationStruct = { value: null, unit: "unknown" };
  for (const [qid, a] of Object.entries(answers)) {
    if (!/(duration|since|days)$/i.test(qid) && qid !== "symptom_duration" && qid !== "symptom_since") continue;
    const labels = selectedLabels(a, { skipNone: false });
    const raw = labels[0] || a.message || "";
    if (!raw) continue;
    durationText = raw;
    const blob = String(raw).toLowerCase() + " " + selectedIds(a).join(" ");
    if (/less than 3 days|lt_3d/.test(blob)) {
      durationStruct = { value: "<3", unit: "days" };
      durationText = durationText || "Less than 3 days";
    } else if (/1 to 2 weeks|1_2w/.test(blob)) {
      durationStruct = { value: "1-2", unit: "weeks" };
      durationText = durationText || "1 to 2 weeks";
    } else if (/more than 6 weeks|gt_6w/.test(blob)) {
      durationStruct = { value: ">6", unit: "weeks" };
      durationText = durationText || "More than 6 weeks";
    } else if (/3 to 7 days|3_7d/.test(blob)) {
      durationStruct = { value: "3-7", unit: "days" };
      durationText = durationText || "3 to 7 days";
    } else if (/more than 7 days|gt_7d/.test(blob)) {
      durationStruct = { value: ">7", unit: "days" };
      durationText = durationText || "More than 7 days";
    } else if (/1-2 days|d1_2/.test(blob)) {
      durationStruct = { value: "1-2", unit: "days" };
    } else if (/3-5 days|d3_5/.test(blob)) {
      durationStruct = { value: "3-5", unit: "days" };
    } else if (/5-7 days|d5_7/.test(blob)) {
      durationStruct = { value: "5-7", unit: "days" };
    } else if (/6-8 days|d6_8/.test(blob)) {
      durationStruct = { value: "6-8", unit: "days" };
    }
    break;
  }

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

  for (const [qid, a] of Object.entries(answers)) {
    if (SKIP_QIDS.has(qid)) continue;
    if (/(duration|since)$/i.test(qid)) continue;

    if (/redflag|red_flag|urgent/i.test(qid)) {
      for (const label of selectedLabels(a)) {
        redFlags.push({
          id: `rf_branch_${redFlags.length + 1}`,
          text: label,
          source: "patient_reported",
          confidence: "high",
        });
      }
      continue;
    }

    const labels = selectedLabels(a);
    if (!labels.length && a.message) {
      if (a.message && !qualifiers.includes(a.message)) qualifiers.push(a.message);
      continue;
    }
    for (const v of labels) {
      if (/character|describe|pattern|type|appearance|color|frequency|location|temp/i.test(qid)) {
        if (!qualifiers.includes(v)) qualifiers.push(v);
      } else if (/symptom|associated|feel|along|which of these|exposure/i.test(qid) || /_symptoms$/.test(qid)) {
        if (!associated.includes(v)) associated.push(v);
      } else {
        if (!associated.includes(v)) associated.push(v);
      }
    }
  }

  if (trendText) qualifiers.push(`Trend: ${trendText}`);

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

  const summaryLines = [];
  if (chiefText) {
    const head = [chiefText];
    if (durationText) head.push(durationText);
    else if (durationStruct.value != null) head.push(`${durationStruct.value} ${durationStruct.unit}`);
    if (course !== "unknown") head.push(course);
    summaryLines.push(head.join(" · "));
  }
  if (associated.length) summaryLines.push("Associated: " + associated.join(", "));
  if (qualifiers.length) {
    const qClean = qualifiers.filter((q) => !/^Trend:/i.test(q));
    if (qClean.length) summaryLines.push("Details: " + qClean.join(", "));
  }
  if (allergies.status === "none_reported") summaryLines.push("Allergies: no known drug allergy");
  else if (allergies.items.length) summaryLines.push("Allergies: " + allergies.items.join(", "));
  if (medicalHistory.items.length) summaryLines.push("Medical history: " + medicalHistory.items.join("; "));
  else if (medicalHistory.status === "none_reported") summaryLines.push("Medical history: none reported");
  if (currentMeds.items.length) summaryLines.push("Current medicines: " + currentMeds.items.join(", "));
  else if (currentMeds.status === "none_reported") summaryLines.push("Current medicines: none");
  if (redFlags.length) summaryLines.push("Concerning: " + redFlags.map((f) => f.text).join(", "));

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
    completion: {
      ...base.completion,
      complaints: complaints.length > 0,
      allergies: allergies.status !== "unknown",
      medical_history: medicalHistory.status !== "unknown",
      current_medications: currentMeds.status !== "unknown",
    },
    summary,
    screening_status: redFlags.length ? "urgent" : "completed",
    data_quality_notes: ["deterministic_cascading_pack"],
  };
}
