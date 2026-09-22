const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.tsx');
let count = 0;
files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  if (code.includes('initialFocus')) {
    const fixed = code.replace(/initialFocus(\s*={true}|\s*)/g, '');
    fs.writeFileSync(file, fixed, 'utf8');
    count++;
  }
});

console.log(`Fixed initialFocus in ${count} files.`);
