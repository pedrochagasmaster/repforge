const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(
  'const standalone=await installTransferStandaloneClient({preserveCleanupMarker:true});',
  'const standalone=await installTransferStandaloneClient();'
);
code = code.replace(
  'const standalone=await installTransferStandaloneClient();',
  'const standalone=await installTransferStandaloneClient({preserveCleanupMarker:true});'
);

fs.writeFileSync('app.js', code);
