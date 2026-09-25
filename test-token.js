import "dotenv/config";

const token = process.env.WA_ACCESS_TOKEN;

const response = await fetch(
  "https://graph.facebook.com/v21.0/me",
  {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
);

const data = await response.json().catch(() => ({}));

console.log("HTTP STATUS:", response.status);
console.log(JSON.stringify(data, null, 2));