import {id,toUtf8Bytes} from 'ethers';
import {integer,amount} from './control.mjs';

export function claimArguments(values){
 const reference=String(values.reference??'').trim(),reason=String(values.reason??'').trim(),evidence=String(values.evidence??'').trim();
 if(!reference||!reason||!evidence)throw Error('请填写关联记录、申诉原因和证据说明或链接。');
 const statement=`关联记录：${reference}\n申诉原因：${reason}\n证据：${evidence}`;
 if(toUtf8Bytes(statement).length>1024||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(statement))throw Error('申诉正文合计最多 1024 个 UTF-8 字节，且不能包含控制字符。');
 return [integer(values.incident,{min:1n}),id(reference),amount(values.requested),statement,id(evidence)];
}

export function claimRecord(result) {
 const {incidentId,lossKey,beneficiary,maxLoss,amount,evidenceHash,reasonHash,state}=result;
 // An on-chain string can contain arbitrary bytes. Keep other fields readable.
 let statement;
 try {
  statement=result.statement;
 } catch {
  statement='申诉正文的编码无效。可按证据摘要核对原始材料。';
 }
 return {incidentId,lossKey,beneficiary,maxLoss,amount,evidenceHash,reasonHash,state,statement};
}
