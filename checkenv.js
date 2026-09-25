import "dotenv/config";

const token = process.env.WA_ACCESS_TOKEN || "";

console.log("================================");
console.log("AI Clinical Screening ENV CHECK");
console.log("================================");
console.log("WA_ACCESS_TOKEN present :", Boolean(token));
console.log("WA_ACCESS_TOKEN length  :", token.length);
console.log("WA_ACCESS_TOKEN first 6 :", token.slice(0, 6));
console.log("WA_ACCESS_TOKEN last 4  :", token.slice(-4));
console.log("WA_PHONE_NUMBER_ID      :", process.env.WA_PHONE_NUMBER_ID || "(missing)");
console.log("WA_API_VERSION          :", process.env.WA_API_VERSION || "(missing)");
console.log("SARVAM_API_KEY present  :", Boolean(process.env.SARVAM_API_KEY));
console.log("SARVAM_MODEL            :", process.env.SARVAM_MODEL || "(missing)");
console.log("================================");