const hre=require('hardhat');const {read,councilCall}=require('./common.cjs');
async function main(){if((await hre.ethers.provider.getNetwork()).chainId!==31337n)throw Error('LOCAL ONLY');const d=read(31337);const s=await hre.ethers.getSigners();const council=await hre.ethers.getContractAt('LocalCouncil',d.admin);const router=await hre.ethers.getContractAt('FeeRouter',d.contracts.FeeRouter);
 if(await router.reserve()===hre.ethers.ZeroAddress)await councilCall(hre,council,router,'setReserveOnce',[d.contracts.RiskReserve]);
 const auction=await hre.ethers.getContractAt('AuctionHouse',d.contracts.AuctionHouse);
 if(await auction.settlementKeeper()===hre.ethers.ZeroAddress)await councilCall(hre,council,auction,'setSettlementKeeper',[s[9].address]);
 if(!d.collections.length)throw Error('Run deploy:test-assets first');
 for(const c of d.collections){for(const name of ['Marketplace','AuctionHouse']){const contract=await hre.ethers.getContractAt(name,d.contracts[name]);if(!await contract.allowedCollections(c.address))await councilCall(hre,council,contract,'setCollection',[c.address,true]);}
 const nft=await hre.ethers.getContractAt('DemoNFT',c.address);if(await nft.nextTokenId()===0n){for(let i=0;i<6;i++){const meta={name:`Study Object #${i+1}`,description:'Test-only digital object. No real-world rights or value promised.'};const uri='data:application/json;base64,'+Buffer.from(JSON.stringify(meta)).toString('base64');await(await nft.mint(await s[3+i%3].getAddress(),uri)).wait();}}}
 console.log('Seed complete. Wallets 0–2: council; 3: seller; 4: buyer; 5: bidder. Repeating does not duplicate initial mints.');}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
