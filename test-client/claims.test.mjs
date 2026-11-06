import test from 'node:test';
import assert from 'node:assert/strict';
import {AbiCoder,id,parseEther,ZeroAddress,ZeroHash} from 'ethers';
import {claimArguments} from '../src/lib/claims.mjs';
import {readReserve} from '../src/services/queries/reserve.mjs';

const input={incident:'1',reference:'market order 12',requested:'0.001',reason:'NFT settlement issue',evidence:'https://example.com/evidence'};
test('claim arguments preserve public review details and do not accept a nominated beneficiary',()=>{
 const args=claimArguments({...input,beneficiary:'someone else'});
 assert.deepEqual(args.slice(0,3),[1n,id(input.reference),parseEther('.001')]);
 for(const text of [input.reference,input.reason,input.evidence])assert.ok(args[3].includes(text));
 assert.equal(args[4],id(input.evidence));assert.equal(args.length,5);
});
test('blank fields, invalid amount, non-integer IDs, control characters and long UTF-8 claims fail before signing',()=>{
 for(const field of ['reference','reason','evidence'])assert.throws(()=>claimArguments({...input,[field]:'  '}));
 for(const requested of ['0','-1','1e3','1.0000000000000000001'])assert.throws(()=>claimArguments({...input,requested}));
 for(const incident of ['0','-1','1.2'])assert.throws(()=>claimArguments({...input,incident}));
 assert.throws(()=>claimArguments({...input,reason:'中'.repeat(342)}),/1024/);
 assert.throws(()=>claimArguments({...input,reason:'bad\0text'}),/控制字符/);
});

test('an invalid on-chain UTF-8 statement cannot hide other claims or approved payout data',async()=>{
 const coder=AbiCoder.defaultAbiCoder();
 const fields='uint256 incidentId,bytes32 lossKey,address beneficiary,uint256 maxLoss,uint256 amount,bytes32 evidenceHash,bytes32 reasonHash,uint8 state';
 const encodeClaim=(statementType,statement)=>coder.encode(
  [`tuple(${fields},${statementType} statement)`],
  [[1n,ZeroHash,ZeroAddress,3n,2n,ZeroHash,ZeroHash,3n,statement]]
 );
 const claims=[encodeClaim('bytes','0xff'),encodeClaim('string','普通申诉')].map(value=>
  coder.decode([`tuple(${fields},string statement)`],value)[0]
 );
 assert.throws(()=>claims[0].toObject(),/deferred error/i);
 const reserve={
  incidentCount:async()=>0n,claimCount:async()=>2n,available:async()=>0n,
  totalIncidentReserved:async()=>0n,paused:async()=>false,
  getClaim:async claimId=>claims[claimId-1]
 };
 const result=await readReserve({contracts:{RiskReserve:reserve},provider:{getBalance:async()=>0n}},{block:{number:1}});
 assert.equal(result.claims[0].statement,'普通申诉');
 assert.match(result.claims[1].statement,/编码无效/);
 assert.equal(result.claims[1].state,3n);
 assert.equal(result.claims[1].amount,2n);
});
