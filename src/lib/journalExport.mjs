import {createTableFile} from './tabularExport.mjs';

export function journalRows(journal) {
  return [
    ['记录时间 UTC','操作','状态','操作账户','网络 Chain ID','交易哈希','详细信息','管理地址','部署标识'],
    ...journal.map(entry => [entry.at,entry.action,entry.state,entry.account,entry.chainId,
      entry.hash,entry.detail,entry.admin,entry.deploymentIdentity].map(value => String(value ?? '')))
  ];
}

export function createJournalFile(journal,format,chainId) {
  return createTableFile(journalRows(journal),format,{
    base:`activity-${chainId}`,sheetName:'操作日志',widths:[27,28,16,46,18,70,65,46,70]
  });
}
