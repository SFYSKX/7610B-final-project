const {spawn}=require('node:child_process');const net=require('node:net');const path=require('node:path');const fs=require('node:fs');
const isolated=process.argv.includes('--isolated'),rpcPort=isolated?18545:8545,webPort=isolated?15173:5173;
process.env.LOCAL_RPC_URL=`http://127.0.0.1:${rpcPort}`;
const root=path.resolve(__dirname,'..');const children=[];let stopping=false;
function stop(){if(stopping)return;stopping=true;for(const p of children)p.kill();}
process.on('SIGINT',()=>{stop();process.exit(0);});process.on('SIGTERM',()=>{stop();process.exit(0);});process.on('exit',stop);
function occupied(port){return new Promise(resolve=>{const socket=net.connect({port,host:'127.0.0.1'});socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));});}
function start(script,args=[],options={}){const p=spawn(process.execPath,[script,...args],{cwd:root,stdio:'inherit',windowsHide:true,...options});children.push(p);return p;}
function run(script,args){return new Promise((resolve,reject)=>{const p=start(script,args);p.once('error',reject);p.once('exit',code=>code===0?resolve():reject(Error(`Command exited ${code}`)));});}
async function main(){for(const port of [rpcPort,webPort])if(await occupied(port))throw Error(`Port ${port} is already in use. Do not reset it. For an existing platform use npm run dev, or stop the correct previous process manually.`);
 // Keep the previous deployment references before a fresh disposable chain replaces them.
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 for(const dir of ['deployments','public/deployments']){const file=path.join(root,dir,'31337.json');if(fs.existsSync(file)){const archive=path.join(root,'deployments','archive',stamp,dir);fs.mkdirSync(archive,{recursive:true});fs.copyFileSync(file,path.join(archive,'31337.json'));}}
 const hardhat='node_modules/hardhat/internal/cli/cli.js';await run(hardhat,['compile']);await run('scripts/export.cjs',[]);
 fs.mkdirSync('reports',{recursive:true});const log=fs.openSync('reports/local-node.log','w');
 const node=start(hardhat,['--config','hardhat.local.config.cjs','node','--hostname','127.0.0.1','--port',String(rpcPort)],{stdio:['ignore',log,log]});fs.closeSync(log);console.log('Local node logs: reports/local-node.log (local fixture keys; excluded from sharing).');node.once('exit',()=>{if(!stopping){stop();process.exitCode=1;}});
 for(let i=0;i<60;i++){if(await occupied(rpcPort))break;await new Promise(r=>setTimeout(r,500));if(i===59)throw Error('Local chain did not start');}
 for(const script of ['deploy','assets','seed'])await run(hardhat,['run',`scripts/${script}.cjs`,'--network','localhost']);
 const keeper=start('scripts/settler.cjs',['--local']);keeper.once('exit',code=>{if(!stopping)console.error('自动结算服务已停止，错误码 '+code+'；请检查服务日志。');});
 start('node_modules/vite/bin/vite.js',['--host','127.0.0.1','--port',String(webPort),'--strictPort']);console.log(`\n打开 http://127.0.0.1:${webPort} 并点击 本地演示。RPC ${rpcPort}。Ctrl+C 停止本次演示。`);}
main().catch(e=>{console.error(e.message);stop();process.exitCode=1;});
