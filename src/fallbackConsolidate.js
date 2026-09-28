// Deterministic screening consolidate fallback from selected answer chips.
// Used when Sarvam consolidate fails so MediLoop still receives real detail.

function detectSiteLocal(session) {
  const t = (
    String(session.patient?.complaint || "").toLowerCase() + " \n " +
    (session.conversation || []).filter((x) => x.role === "patient").map((x) => x.message).join(" \n ")
  ).toLowerCase();
  const sites = [];
  if (/\bear\b|otalg|hearing|tinnitus|otitis|eardrum/.test(t)) sites.push("ear");
  if (/\bnose\b|nasal|sinus|smell|sneeze|rhinit|blocked nose|runny/.test(t)) sites.push("nose");
  if (/\bthroat\b|swallow|voice|tonsil|pharyng|sore throat/.test(t)) sites.push("throat");
  return sites;
}

function patientTextLocal(session) {
  return (session.conversation || [])
    .filter((x) => x.role === "patient")
    .map((x) => x.message)
    .join(" \n ")
    .toLowerCase();
}

export function buildFallbackFromConversation(session, base) {
  const sites = detectSiteLocal(session);
  const pt = patientTextLocal(session);
  const conv = session.conversation || [];

  const values = [];
  for (const x of conv) {
    if (x.role !== "patient") continue;
    if (x.selected_option?.value && x.selected_option.value !== "__FREE_TEXT__") {
      values.push(String(x.selected_option.value).trim().toLowerCase());
    } else if (x.message) {
      values.push(String(x.message).trim().toLowerCase());
    }
  }
  const blob = values.join(" | ");

  function findOne(re) {
    for (const v of values) if (re.test(v)) return v;
    return null;
  }
  function findAll(re) {
    return values.filter((v) => re.test(v));
  }

  let laterality = "unknown";
  if (/\bleft\b/.test(blob) && /\bright\b/.test(blob)) laterality = "bilateral";
  else if (/\bbilateral\b|both sides|both ears/.test(blob)) laterality = "bilateral";
  else if (/\bleft\b/.test(blob)) laterality = "left";
  else if (/\bright\b/.test(blob)) laterality = "right";

  let duration = { value: null, unit: "unknown" };
  const durMatch = blob.match(/for\s+(\d+)\s+to\s+(\d+)\s+days/) ||
    blob.match(/for\s+(\d+)\s*-\s*(\d+)\s*days/) ||
    blob.match(/(\d+)\s*[-–]\s*(\d+)\s*days/) ||
    blob.match(/for\s+(\d+)\s+days/) ||
    blob.match(/(\d+)\s+days/);
  if (durMatch) {
    const a = Number(durMatch[1]);
    const b = durMatch[2] != null ? Number(durMatch[2]) : a;
    duration = { value: b >= a ? `${a}-${b}` : String(a), unit: "days" };
  } else if (/1\s*[-–to]+\s*2\s*weeks|for 1 to 2 weeks/.test(blob)) {
    duration = { value: "1-2", unit: "weeks" };
  } else if (/more than 2 weeks/.test(blob)) {
    duration = { value: ">2", unit: "weeks" };
  }

  let course = "unknown";
  if (/getting worse|worsening/.test(blob)) course = "worsening";
  else if (/getting better|improving/.test(blob)) course = "improving";
  else if (/staying the same|about the same|stable/.test(blob)) course = "stable";

  let severity = "unknown";
  if (/\bsevere\b/.test(blob)) severity = "severe";
  else if (/\bmoderate\b/.test(blob)) severity = "moderate";
  else if (/\bmild\b/.test(blob)) severity = "mild";

  const symptomHints = findAll(
    /ear pain|ear blockage|ear discharge|hearing trouble|tinnitus|nasal blockage|runny nose|nasal discharge|sneezing|throat pain|sore throat|voice change/
  );
  const discharge = findOne(/watery clear discharge|thick discharge|yellow discharge|green discharge|bloody discharge|no discharge/);
  const associated = [];
  if (discharge && discharge !== "no discharge") associated.push(discharge);
  for (const v of findAll(/fever|dizziness|spinning|lightheaded|swollen neck glands|voice change|recent cold|hearing feels muffled|reduced hearing/)) {
    if (!associated.includes(v)) associated.push(v);
  }

  let treatment_tried = { status: "unknown", items: [] };
  if (/not tried any medicine|nothing tried/.test(blob)) {
    treatment_tried = { status: "none", items: [] };
  } else {
    const meds = findAll(/took painkiller|used ear drops|took antibiotic|tried home remedy|medicine helped|medicine did not help/);
    if (meds.length) treatment_tried = { status: "reported", items: meds };
  }

  if (/no known drug allergy|no allergy|not allergic|nka/.test(blob)) {
    base.allergies = { status: "none_reported", items: [] };
    base.completion.allergies = true;
  } else if (/drug allergy reported|allergic to/.test(blob)) {
    const allergyItems = findAll(/allergic|allergy/).filter((v) => !/no known/.test(v));
    base.allergies = { status: "reported", items: allergyItems.length ? allergyItems : ["drug allergy reported"] };
    base.completion.allergies = true;
  }

  const hx = findAll(/high blood pressure|diabetes|asthma|other ongoing illness/);
  if (hx.length) {
    base.medical_history = { status: "reported", items: hx };
    base.completion.medical_history = true;
  } else if (/no ongoing illness|none reported/.test(blob) && /diabetes|blood pressure|ongoing/.test(blob)) {
    base.medical_history = { status: "none_reported", items: [] };
    base.completion.medical_history = true;
  }

  const site = sites[0] || "ear";
  let mainText = symptomHints[0] || (site === "ear" ? "Ear symptoms" : site === "nose" ? "Nasal symptoms" : "Throat symptoms");
  if (symptomHints.length > 1) mainText = symptomHints.join(", ");

  base.complaints = [{
    id: "c1",
    text: mainText,
    laterality,
    duration,
    course,
    severity,
    associated_symptoms: associated,
    qualifiers: [],
    impact: "",
    treatment_tried,
    priority: "chief",
    source: "patient_reported",
    confidence: symptomHints.length || associated.length ? "medium" : "low",
  }];
  base.completion.complaints = true;

  const summaryBits = [];
  summaryBits.push(mainText);
  if (laterality !== "unknown") summaryBits.push(laterality);
  if (duration.value != null) summaryBits.push(`for ${duration.value} ${duration.unit}`);
  if (course !== "unknown") summaryBits.push(course);
  if (severity !== "unknown") summaryBits.push(severity);
  if (associated.length) summaryBits.push(associated.join(", "));
  if (treatment_tried.status === "none") summaryBits.push("not tried any medicine");
  else if (treatment_tried.items.length) summaryBits.push(treatment_tried.items.join(", "));
  if (base.allergies?.status === "none_reported") summaryBits.push("no known drug allergy");
  else if (base.allergies?.items?.length) summaryBits.push("allergies: " + base.allergies.items.join(", "));
  if (base.medical_history?.items?.length) summaryBits.push(base.medical_history.items.join("; "));

  base.summary = summaryBits.filter(Boolean).join(", ") || pt.slice(0, 1200) || base.summary;
  base.data_quality_notes = ["fallback_from_selected_answers"];
  return base;
}
