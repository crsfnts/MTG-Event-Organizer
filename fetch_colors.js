import https from 'https';

https.get('https://dusk-mart.com', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const colors = data.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/g);
    if (colors) {
      const counts = {};
      colors.forEach(c => counts[c.toLowerCase()] = (counts[c.toLowerCase()] || 0) + 1);
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
      console.log(sorted);
    } else {
      console.log("No colors found in HTML.");
    }
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
