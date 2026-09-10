const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(
  'function installTransferInboundStore(){',
  'function installTransferInboundStore({preserveCleanupMarker=false}={}){\n  let deferCleanupClear=false;'
);
code = code.replace(
  'async write(marker){localStorage.setItem(INSTALL_INBOUND_KEY,JSON.stringify(marker))},',
  'async write(marker){\n      const previous=installTransferReadInboundMarker();\n      if(preserveCleanupMarker&&marker?.phase==="cleanup-pending"&&marker.remoteState==="deleted"&&previous?.phase==="local-committed")\n        deferCleanupClear=true;\n      localStorage.setItem(INSTALL_INBOUND_KEY,JSON.stringify(marker))},'
);
code = code.replace(
  'async clear(){localStorage.removeItem(INSTALL_INBOUND_KEY)},',
  'async clear(){\n      if(deferCleanupClear){deferCleanupClear=false;return}\n      localStorage.removeItem(INSTALL_INBOUND_KEY)},'
);
code = code.replace(
  'async function installTransferStandaloneClient(){',
  'async function installTransferStandaloneClient({preserveCleanupMarker=false}={}){'
);
code = code.replace(
  'const inbound=installTransferInboundStore();',
  'const inbound=installTransferInboundStore({preserveCleanupMarker});'
);

code = code.replace(
  'const standalone=await installTransferStandaloneClient();',
  'const standalone=await installTransferStandaloneClient({preserveCleanupMarker:true});'
);

fs.writeFileSync('app.js', code);
