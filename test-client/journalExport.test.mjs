import test from 'node:test';
import assert from 'node:assert/strict';
import {createJournalFile,journalRows} from '../src/lib/journalExport.mjs';
import {selectJournal} from '../src/services/journal.mjs';

const account='0x0000000000000000000000000000000000000011';
const other='0x0000000000000000000000000000000000000022';
const session={account,chainId:31337,config:{admin:other,deploymentIdentity:'deployment-one'}};
const entry={at:'2026-11-06T12:00:00.000Z',action:'购买 NFT',state:'success',account,chainId:31337,
  hash:'0x'+'a'.repeat(64),admin:other,deploymentIdentity:'deployment-one'};

test('journal CSV has readable columns, UTF-8 BOM and safe multiline formula-like cells',async()=>{
  const file=await createJournalFile([entry,{...entry,hash:undefined,detail:'  =bad,"value"\n说明'}],'csv',31337);
  assert.equal(file.name,'activity-31337.csv');assert.equal(file.content[0],'\uFEFF');
  assert.ok(file.content.includes('记录时间 UTC'));assert.ok(file.content.includes('购买 NFT'));
  assert.ok(file.content.includes('"\'  =bad,""value""\n说明"'));assert.ok(file.content.includes(entry.hash));
  assert.equal(journalRows([{}])[1].every(value=>value===''),true);
});

test('journal Excel reopens with one log per row and preserves literal text and identifiers',async()=>{
  const file=await createJournalFile([entry,{...entry,state:'error',detail:'=1+1'}],'xlsx',31337);
  const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(file.content);const sheet=workbook.getWorksheet('操作日志');
  assert.equal(file.name,'activity-31337.xlsx');assert.equal(sheet.rowCount,3);
  assert.equal(sheet.getCell('D2').value,account);assert.equal(sheet.getCell('E2').value,'31337');
  assert.equal(sheet.getCell('F2').value,entry.hash);assert.equal(sheet.getCell('G3').value,'=1+1');
  await assert.rejects(createJournalFile([entry],'json',31337),/格式/);
});

test('export retains the existing account, administrator and deployment-scoped log selection',async()=>{
  const all=[entry,{...entry,account:other},{...entry,chainId:11155111},{...entry,deploymentIdentity:'different'},{}];
  const own=selectJournal(all,session,false),admin=selectJournal(all,session,true);
  assert.equal(journalRows(own).length,2);assert.equal(journalRows(admin).length,3);
  const file=await createJournalFile(own,'csv',31337);
  assert.equal(file.content.includes('different'),false);assert.equal(file.content.includes('11155111'),false);
});

test('empty logs produce a header and long Excel details use lossless continuation rows',async()=>{
  assert.equal(journalRows([]).length,1);
  const detail='🎨'.repeat(33000);
  const file=await createJournalFile([{...entry,detail}],'xlsx',31337);
  const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(file.content);const parts=[];
  workbook.getWorksheet('操作日志').eachRow((row,index)=>{if(index>1){const part=row.getCell('G').value;assert.ok(part.length<=30000);parts.push(part);}});
  assert.equal(parts.join(''),detail);
});
