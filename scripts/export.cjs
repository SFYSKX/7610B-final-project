const fs=require('node:fs');const path=require('node:path');
fs.mkdirSync('src/contracts',{recursive:true});
for(const [name,file] of Object.entries({Marketplace:'Marketplace',AuctionHouse:'AuctionHouse',RiskReserve:'RiskReserve',FeeRouter:'FeeRouter',DemoNFT:'test/DemoNFT',LocalCouncil:'test/LocalCouncil'})){
 const a=JSON.parse(fs.readFileSync(path.join('artifacts/contracts',`${file}.sol`,`${name}.json`)));
 fs.writeFileSync(`src/contracts/${name}.json`,JSON.stringify({contractName:name,abi:a.abi},null,2));
}
console.log('Exported six ABIs. No deployment or minting performed.');
