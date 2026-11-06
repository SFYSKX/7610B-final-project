import {csvCell} from './control.mjs';

function splitCell(value) {
  const text = String(value ?? '');
  const parts = [];
  for (let offset = 0; offset < text.length;) {
    let end = Math.min(offset+30000,text.length);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end-1]) && /[\uDC00-\uDFFF]/.test(text[end])) end--;
    parts.push(text.slice(offset,end));
    offset = end;
  }
  return parts.length ? parts : [''];
}

function excelRows(rows) {
  return rows.flatMap(row => {
    const cells = row.map(splitCell);
    const count = Math.max(...cells.map(parts => parts.length));
    return Array.from({length:count},(_,part) => cells.map((parts,column) => {
      if (column === 0 && part > 0 && parts.length === 1) return `${parts[0]}（续 ${part+1}）`;
      return parts[part] || '';
    }));
  });
}

export async function createTableFile(rows,format,{base,sheetName,widths}) {
  if (format === 'csv') {
    const safeCell = value => csvCell(/^\s+[=+\-@]/.test(String(value ?? '')) ? "'"+value : value);
    return {name:base+'.csv',type:'text/csv;charset=utf-8',content:'\uFEFF'+rows.map(row => row.map(safeCell).join(',')).join('\r\n')};
  }
  if (format !== 'xlsx') throw Error('请选择 CSV 或 Excel 格式。');
  const {default:ExcelJS} = await import('exceljs/dist/exceljs.min.js');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = widths.map(width => ({width}));
  // Keep identifiers and amounts as text, and split long values within Excel cell limits.
  sheet.addRows(excelRows(rows));
  sheet.getRow(1).font = {bold:true,color:{argb:'FFFFFFFF'}};
  sheet.getRow(1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF183E32'}};
  sheet.eachRow(row => {
    row.alignment = {vertical:'top',wrapText:true};
    row.eachCell(cell => {cell.numFmt = '@';});
  });
  sheet.views = [{state:'frozen',ySplit:1}];
  return {name:base+'.xlsx',type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',content:await workbook.xlsx.writeBuffer()};
}
