const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./src/app');
let modified = 0;
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    const target = /<Badge variant=\{eq\.breakdownStatus === 'Active' \? 'destructive' : 'default'\} className=\"bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none\">\s*\{eq\.breakdownStatus \|\| 'Operational'\}\s*<\/Badge>/g;
    
    if (target.test(content)) {
        const replacement = `<Badge variant={eq.status === 'inactive' || eq.breakdownStatus === 'Active' ? 'destructive' : 'default'} className={eq.status === 'inactive' || eq.breakdownStatus === 'Active' ? 'bg-red-500 text-white hover:bg-red-600 border-none' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none'}>\n                                  {eq.status === 'inactive' ? 'Inactive' : (eq.breakdownStatus === 'Active' ? 'Breakdown' : (eq.breakdownStatus || 'Operational'))}\n                              </Badge>`;
        content = content.replace(target, replacement);
        fs.writeFileSync(f, content, 'utf8');
        modified++;
    }
});
console.log('Modified ' + modified + ' files.');
