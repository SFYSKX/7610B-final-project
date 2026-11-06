const hre = require('hardhat');
const fs = require('node:fs');
const {save, read} = require('./common.cjs');

async function main() {
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  if (![31337, 11155111].includes(chainId)) throw Error('Unsupported chain');
  if (chainId !== 31337 && process.env.CONFIRM_TESTNET_DEPLOY !== 'yes') {
    throw Error('Set CONFIRM_TESTNET_DEPLOY=yes after reviewing README');
  }
  let d;
  if (fs.existsSync(`deployments/${chainId}.json`)) {
    d = read(chainId);
    if(d.status==='deploying'&&d.apiVersion!==2)throw Error('Cannot resume an older API deployment as v2. Archive it explicitly first.');
    const code = await Promise.all(Object.values(d.contracts).map(a => hre.ethers.provider.getCode(a)));
    if (code.some(c => c !== '0x') && d.status !== 'deploying') {
      throw Error('Deployment already exists on this chain. Reuse it; archive its manifest explicitly before deploying a new version.');
    }
    if (code.every(c => c === '0x') && chainId === 31337) d = null;
  }
  d ||= {release:'2.0.0',apiVersion:2,chainId,status:'deploying',adminMode:chainId===31337?'LOCAL_COUNCIL':'SAFE',contracts:{},collections:[],deploymentTransactions:{}};
  // Record each submitted deployment before waiting. An unknown receipt is not an instruction to resend.
  async function one(name, args) {
    if (d.contracts[name]) {
      const hash = d.deploymentTransactions[name];
      const receipt = hash && await hre.ethers.provider.getTransactionReceipt(hash);
      if (!receipt) throw Error(`${name}: submitted transaction has no receipt; inspect ${hash} before retrying.`);
      if (receipt.status !== 1 || await hre.ethers.provider.getCode(d.contracts[name]) === '0x') throw Error(`${name}: recorded deployment is invalid; inspect before changing the checkpoint.`);
      return hre.ethers.getContractAt(name, d.contracts[name]);
    }
    const contract = await (await hre.ethers.getContractFactory(name)).deploy(...args);
    d.contracts[name] = await contract.getAddress();
    d.deploymentTransactions[name] = contract.deploymentTransaction().hash;
    save(d);
    const receipt = await contract.deploymentTransaction().wait(1, 90000);
    if (!receipt || receipt.status !== 1) throw Error(`${name}: deployment not confirmed`);
    d.deploymentBlock = Math.min(d.deploymentBlock ?? receipt.blockNumber, receipt.blockNumber);
    save(d);
    console.log(`${name}: ${d.contracts[name]} (${receipt.hash})`);
    return contract;
  }
  if (chainId === 31337) {
    const signers = await hre.ethers.getSigners();
    d.admin = await (await one('LocalCouncil', [signers.slice(0,3).map(s=>s.address)])).getAddress();
  } else {
    const admin = hre.ethers.getAddress(process.env.SAFE_ADDRESS || '');
    if (d.admin && d.admin !== admin) throw Error('Cannot resume with a different Safe');
    if (await hre.ethers.provider.getCode(admin) === '0x') throw Error('SAFE_ADDRESS must be a contract');
    const safe = new hre.ethers.Contract(admin, ['function getThreshold() view returns(uint256)','function getOwners() view returns(address[])'], hre.ethers.provider);
    if (await safe.getThreshold() < 2n || (await safe.getOwners()).length < 3) throw Error('Safe must have >=3 owners and threshold >=2');
    d.admin = admin;
  }
  if(chainId===31337)d.localRpcUrl=hre.network.config.url||'http://127.0.0.1:8545';
  save(d);
  await one('RiskReserve', [d.admin]);
  await one('FeeRouter', [d.admin, 5000]);
  await one('Marketplace', [d.admin, d.contracts.FeeRouter]);
  await one('AuctionHouse', [d.admin, d.contracts.FeeRouter]);
  for (const name of ['RiskReserve','FeeRouter','Marketplace','AuctionHouse']) {
    const c = await hre.ethers.getContractAt(name,d.contracts[name]);
    if (await c.owner() !== d.admin || await c.API_VERSION() !== (name==='RiskReserve'?3n:2n)) throw Error('Resume config mismatch: '+name);
  }
  d.deploymentIdentity=(await hre.ethers.provider.getBlock(d.deploymentBlock)).hash;
  d.status = 'complete'; save(d);
  console.log('Platform deployment complete. Test assets are a separate step.');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
