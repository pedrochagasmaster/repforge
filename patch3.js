const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Reset both to empty first
code = code.replace(
  /const standalone=await installTransferStandaloneClient\(\{preserveCleanupMarker:true\}\);/g,
  'const standalone=await installTransferStandaloneClient();'
);

// Now specifically set the bottom one (before .client.claim()) to true
code = code.replace(
  'const standalone=await installTransferStandaloneClient();\n    const claimed=await standalone.client.claim();',
  'const standalone=await installTransferStandaloneClient({preserveCleanupMarker:true});\n    const claimed=await standalone.client.claim();'
);

fs.writeFileSync('app.js', code);
