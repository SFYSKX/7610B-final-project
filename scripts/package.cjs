// Prints the shareable source list. Packaging must never include .env or live deployment/log files.
const fs=require('node:fs');const path=require('node:path');
const dirs=['contracts','src','scripts','test','test-client','test-tooling','docs'];
const files=['README.md','package.json','package-lock.json','environment.yml','.env.example','.gitignore','hardhat.config.cjs','hardhat.local.config.cjs','vite.config.mjs','index.html'];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())walk(p);else files.push(p);}}
dirs.forEach(walk);console.log(JSON.stringify(files,null,2));
