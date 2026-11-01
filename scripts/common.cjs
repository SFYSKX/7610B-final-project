const fs=require('node:fs');
function save(d){for(const dir of ['deployments','public/deployments']){fs.mkdirSync(dir,{recursive:true});const file=`${dir}/${d.chainId}.json`,temp=`${file}.${process.pid}.tmp`;fs.writeFileSync(temp,JSON.stringify(d,null,2)+'\n');fs.renameSync(temp,file);}}
function read(chainId){return JSON.parse(fs.readFileSync(`deployments/${chainId}.json`));}
async function deploy(hre,name,args=[]){const c=await(await hre.ethers.getContractFactory(name)).deploy(...args);await c.waitForDeployment();return c;}
async function councilCall(hre,council,target,method,args=[]){const signers=await hre.ethers.getSigners();const data=target.interface.encodeFunctionData(method,args);await(await council.connect(signers[0]).propose(await target.getAddress(),data)).wait();const id=await council.proposalCount();await(await council.connect(signers[1]).approve(id)).wait();await(await council.connect(signers[2]).execute(id)).wait();}
module.exports={save,read,deploy,councilCall};
