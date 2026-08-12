const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/components/layout/sidebar-nav.tsx');
let lines = fs.readFileSync(file, 'utf8').split('\n');

// The lines we want to delete are from index 252 to 282 (lines 253 to 283).
// Let's verify by checking line contents first.
if (lines[253].includes('<Collapsible open={isMiningOpen} onOpenChange={setIsMiningOpen} className="group/mining">')) {
  // delete 31 lines starting from 252 (which is <SidebarMenuSubItem> before Collapsible)
  lines.splice(252, 31);
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log("Deleted old mining block successfully");
} else {
  console.log("Lines didn't match. Searching for start line.");
  let startIdx = -1;
  let endIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('className="group/mining"')) {
      startIdx = i - 1; // <SidebarMenuSubItem>
      break;
    }
  }
  if (startIdx !== -1) {
    for (let i = startIdx; i < lines.length; i++) {
      if (lines[i].includes('{/* Mining Equipment (v2) Parallel Category - NESTED IN ASSETS */}')) {
        endIdx = i; // stop right before the new one
        break;
      }
    }
  }
  if (startIdx !== -1 && endIdx !== -1) {
    lines.splice(startIdx, endIdx - startIdx);
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log("Deleted old mining block successfully via search");
  } else {
    console.log("Could not find the block");
  }
}
