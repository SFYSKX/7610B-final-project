import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAccess} from '../src/services/login.mjs';
import {localAccounts,workspaceAccess} from '../src/lib/access.mjs';

const account='0x0000000000000000000000000000000000000011';
function fixture(isAdmin=false){
  return {mode:'local',account,chainId:31337,config:{admin:'0x0000000000000000000000000000000000000022'},
    provider:{getBlock:async()=>({number:42,timestamp:1000})},
    contracts:{LocalCouncil:{isSigner:async(who,options)=>{
      assert.equal(who,account);assert.equal(options.blockTag,42);return isAdmin;
    }}}};
}

test('login verifies local chain membership and rejects a user selecting the admin entrance',async()=>{
  assert.equal((await verifyAccess(fixture(),'user')).isAdmin,false);
  await assert.rejects(verifyAccess(fixture(),'admin'),{code:'ADMIN_REQUIRED'});
  assert.equal((await verifyAccess(fixture(true),'admin')).isAdmin,true);
  assert.equal((await verifyAccess(fixture(true),'user')).isAdmin,true);
  await assert.rejects(verifyAccess(fixture(),'root'),/请选择/);
});

test('failed, invalid and stalled identity reads never become an authenticated ordinary user',async()=>{
  for(const readRole of [async()=>{throw Error('offline');},async()=>({}),()=>new Promise(()=>{})]){
    await assert.rejects(verifyAccess(fixture(),'user',{readRole,timeoutMs:15}),/身份核验失败/);
  }
});

test('wallet verification rejects account and network changes during identity reads',async()=>{
  const s={...fixture(true),mode:'wallet'};
  const readRole=async()=>({isAdmin:true,isCouncilSigner:false});
  for(const [accounts,chainId]of [[[account],'0x7a69'],[[],'0x7a69'],[[account],'0xaa36a7']]){
    s.provider.send=async method=>method==='eth_accounts'?accounts:chainId;
    if(accounts.length&&chainId==='0x7a69')assert.equal((await verifyAccess(s,'admin',{readRole})).block,42);
    else await assert.rejects(verifyAccess(s,'admin',{readRole}),/身份核验失败/);
  }
});

test('workspace access requires a fresh successful identity snapshot for both entrances',()=>{
  const snapshot={isAdmin:true,modules:{identity:{status:'ready'}}};
  assert.equal(workspaceAccess('admin',null),'checking');
  assert.equal(workspaceAccess('admin',snapshot),'ready');
  assert.equal(workspaceAccess('admin',{...snapshot,isAdmin:false}),'denied');
  assert.equal(workspaceAccess('user',{...snapshot,isAdmin:false}),'ready');
  assert.equal(workspaceAccess('user',{...snapshot,modules:{identity:{status:'error'}}}),'error');
  assert.equal(workspaceAccess('admin',{...snapshot,isAdmin:undefined}),'error');
  assert.equal(workspaceAccess('root',snapshot),'denied');
  assert.deepEqual(localAccounts('admin').map(item=>item.index),[0,1,2]);
  assert.deepEqual(localAccounts('user').map(item=>item.index),[3,4,5,6,7,8]);
});
