const XLSX = require('xlsx');
const workbook = XLSX.readFile('C:/Users/Fritz Schroeder/.gemini/antigravity/brain/681f2b9e-353f-4dd5-ac3b-e3fb7851265f/.user_uploaded/media_1790586165209.xlsx');
// Try to find the sheet
let sheetName = workbook.SheetNames.find(n => n.includes('ACS800-07-1060-7'));
if (!sheetName) sheetName = workbook.SheetNames.find(n => n.includes('1060'));
const sheet = workbook.Sheets[sheetName];
console.log('Sheet name:', sheetName);
const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log('Top rows:', json.slice(0, 10));
