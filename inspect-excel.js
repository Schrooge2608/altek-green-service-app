const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('C:/Users/Fritz Schroeder/.gemini/antigravity/brain/681f2b9e-353f-4dd5-ac3b-e3fb7851265f/.user_uploaded/media_1790586165209.xlsx');
console.log('Sheets:', workbook.SheetNames);
