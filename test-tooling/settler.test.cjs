const test=require('node:test'),assert=require('node:assert/strict');
const {fundedGas}=require('../scripts/settler.cjs');
test('settler checks fee funding before it prepares or broadcasts and can retry after funding',async()=>{
 let balance=1n;const provider={getBalance:async()=>balance,getFeeData:async()=>({maxFeePerGas:2n})};
 const contract={settleAuction:{estimateGas:async()=>100n}};
 await assert.rejects(fundedGas(contract,provider,'account',1),/Gas 余额不足/);
 balance=240n;assert.equal(await fundedGas(contract,provider,'account',1),120n);
});
