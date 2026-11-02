const {spawnSync}=require('child_process');const path=require('path');
const files=['check-bindings.cjs','check-dashboard.cjs','check-accounting.cjs','check-fixed-assets.cjs','check-themes.cjs','check-reference-layout.cjs'];
for(const file of files){const r=spawnSync(process.execPath,[path.join(__dirname,file)],{cwd:__dirname,env:process.env,stdio:'inherit'});if(r.error){console.error(r.error);process.exit(1);}if(r.status!==0)process.exit(r.status||1);}
console.log('PASS all 6 dashboard check suites');
