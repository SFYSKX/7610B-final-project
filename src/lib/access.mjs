export const LOCAL_ACCOUNTS=Object.freeze([
  {index:0,label:'管理签名者 1 · NFT 发行者',role:'admin'},
  {index:1,label:'管理签名者 2',role:'admin'},
  {index:2,label:'管理签名者 3',role:'admin'},
  {index:3,label:'卖方',role:'user'},
  {index:4,label:'买方',role:'user'},
  {index:5,label:'竞价者',role:'user'},
  {index:6,label:'备用用户 7',role:'user'},
  {index:7,label:'备用用户 8',role:'user'},
  {index:8,label:'备用用户 9',role:'user'}
]);

export function localAccounts(role){return LOCAL_ACCOUNTS.filter(account=>account.role===role);}

// The selected entrance is a view preference; only a successful chain read grants access.
export function workspaceAccess(role,data){
  if(!['user','admin'].includes(role))return 'denied';
  if(!data)return 'checking';
  if(data.modules?.identity?.status!=='ready'||typeof data.isAdmin!=='boolean')return 'error';
  return role==='admin'&&!data.isAdmin?'denied':'ready';
}
