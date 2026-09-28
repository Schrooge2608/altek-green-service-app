const fs = require('fs');
let content = fs.readFileSync('src/app/reports/field-service-report/[id]/page.tsx', 'utf8');

const targetStr = `{/* Datalist for Spares Inventory Auto-complete */}
                        <datalist id="spares-list">
                          {sparesList?.map((s) => (
                            <option key={s.id} value={s.rbmCode || s.oemCode || s.description}>
                              {s.description} ({s.manufacturer})
                            </option>
                          ))}
                        </datalist>`;

// Normalize to fix line endings
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = targetStr.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
    // 1. Remove it from inside the table body
    let newContent = normalizedContent.replace(normalizedTarget, '');

    // 2. Insert it ABOVE the table div
    const tableDivStr = '<div className="border-2 border-black mb-0 overflow-hidden">';
    newContent = newContent.replace(tableDivStr, normalizedTarget + '\n                ' + tableDivStr);
    
    fs.writeFileSync('src/app/reports/field-service-report/[id]/page.tsx', newContent, 'utf8');
    console.log("Success");
} else {
    console.log("Target string not found!");
}
