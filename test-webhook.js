const url =
  'https://puny-chefs-tap.loca.lt/webhooks/whatsapp' +
  '?hub.mode=subscribe' +
  '&hub.verify_token=mediloop-verify' +
  '&hub.challenge=test123';

const response = await fetch(url, {
  headers: {
    'bypass-tunnel-reminder': '1'
  }
});

console.log('HTTP STATUS:', response.status);
console.log('RESPONSE:', await response.text());