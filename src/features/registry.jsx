import Market from './market/Market.jsx';
import Inventory from './assets/Inventory.jsx';
import Auctions from './auction/Auctions.jsx';
import History from './history/History.jsx';
import Reserve,{MyClaims} from './reserve/Reserve.jsx';
import Admin from './admin/Admin.jsx';
import Activity from './activity/Activity.jsx';
import Mint from './mint/Mint.jsx';

/** Feature contract: key, label, order, Component, dependencies, optional adminOnly, userOnly and issuerOnly.
 * Components receive {s,data,tx,guarded,disabled,...viewProps}; writes use tx only.
 * Dependencies refer to queryReaders keys and gate the entire feature on read failure.
 */
export const features=Object.freeze([
  {key:'inventory',label:'我的资产',order:'01',Component:Inventory,dependencies:['assets']},
  {key:'market',label:'交易市场',order:'02',Component:Market,dependencies:['market']},
  {key:'auction',label:'公开拍卖',order:'03',Component:Auctions,dependencies:['auction']},
  {key:'history',label:'资产溯源',order:'04',Component:History,dependencies:[]},
  {key:'reserve',label:'风险准备金',order:'05',Component:Reserve,dependencies:['identity','reserve'],adminOnly:true},
  {key:'admin',label:'共同管理',order:'06',Component:Admin,dependencies:['identity','governance','reserve','auction','fees'],adminOnly:true},
  {key:'activity',label:'交易记录',order:'07',Component:Activity,dependencies:[]},
  {key:'claims',label:'我的申诉',order:'08',Component:MyClaims,dependencies:['reserve','identity'],userOnly:true},
  {key:'mint',label:'铸造管理',order:'09',Component:Mint,dependencies:['minting'],issuerOnly:true}
]);
export function visibleFeatures(isAdmin,isIssuer=false,workspace=isAdmin?'admin':'user'){
  const visible=features.filter(feature=>(!feature.adminOnly||(isAdmin&&workspace==='admin'))&&(!feature.userOnly||!isAdmin)&&(!feature.issuerOnly||isIssuer));
  if(workspace!=='admin')return visible;
  const priority=['admin','reserve','activity','history'];
  return [...visible].sort((a,b)=>{
    const rank=feature=>{const index=priority.indexOf(feature.key);return index<0?priority.length:index;};
    return rank(a)-rank(b);
  });
}
