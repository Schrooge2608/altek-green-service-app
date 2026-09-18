
const fs = require("fs");

const filesToUpdate = [
    "src/app/maintenance/page.tsx",
    "src/app/maintenance/unscheduled/history/page.tsx"
];

for (const file of filesToUpdate) {
    let content = fs.readFileSync(file, "utf8");
    
    // Fix keyword matching: remove "battery" and "module"
    const oldKeywords = `const maintenanceKeywords = ["maintenance", "battery", "module", "replace", "rebuild", "service", "repair", "fix", "install"];`;
    const newKeywords = `const maintenanceKeywords = ["maintenance", "replace", "rebuild", "service", "repair", "fix", "install"];`;
    content = content.replace(oldKeywords, newKeywords);
    
    // Fix the link to the daily diary
    const oldLink = `<Link href={\`/reports/contractors-daily-diary/\${item.diaryId}\`}`;
    const newLink = `<Link href={\`/reports/contractors-daily-diary?id=\${item.diaryId}\`}`;
    content = content.replace(oldLink, newLink);
    
    fs.writeFileSync(file, content);
}
console.log("Done");

