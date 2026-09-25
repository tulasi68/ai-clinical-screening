import "dotenv/config";

const token = process.env.WA_ACCESS_TOKEN;
const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
const version = process.env.WA_API_VERSION || "v21.0";

const url =
  `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

const payload = {
  messaging_product: "whatsapp",
  recipient_type: "individual",

  // TEMPORARY: replace with YOUR OWN WhatsApp number
  // in international format, without + or spaces.
  to: 919844771724,

  type: "text",
  text: {
    preview_url: false,
    body: "AI Clinical Screening Meta API test."
  }
};

console.log("Testing Meta WhatsApp Cloud API...");
console.log("Phone Number ID:", phoneNumberId);
console.log("API Version:", version);
console.log("Token loaded:", Boolean(token));
console.log("Token length:", token?.length);

const response = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
});

const data = await response.json().catch(() => ({}));

console.log("");
console.log("HTTP STATUS:", response.status);
console.log("META RESPONSE:");
console.log(JSON.stringify(data, null, 2));