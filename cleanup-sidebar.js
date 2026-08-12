const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/components/layout/sidebar-nav.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove miningDivisions array
content = content.replace(/const miningDivisions = \[\s*\{ href: '\/equipment\/mining\/boosters', label: 'Boosters' \},\s*\{ href: '\/equipment\/mining\/dredgers', label: 'Dredgers' \},\s*\{ href: '\/equipment\/mining\/pump-stations', label: 'Pump Stations' \},\s*\{ href: '\/equipment\/mining\/ups-btus', label: 'UPS\/BTU\\'s' \},\s*\];\n*/, '');

// 2. Remove the old isMiningOpen state
content = content.replace(/const \[isMiningOpen, setIsMiningOpen\] = useState\(false\);\n\s*/, '');

// 3. Rename isV2Open to isMiningOpen
content = content.replace(/isV2Open/g, 'isMiningOpen');
content = content.replace(/setIsV2Open/g, 'setIsMiningOpen');

// 4. Remove the old Mining collapsible block
// The old block starts at <SidebarMenuSubItem> right before <Collapsible open={isMiningOpen} ... className="group/mining">
const oldBlockRegex = /<SidebarMenuSubItem>\s*<Collapsible open=\{isMiningOpen\} onOpenChange=\{setIsMiningOpen\} className="group\/mining">[\s\S]*?<\/SidebarMenuSubItem>/;
content = content.replace(oldBlockRegex, '');

// 5. Change "Mining (v2)" to "Mining" in the new block
content = content.replace(/tooltip="Mining \(v2\)"/g, 'tooltip="Mining"');
content = content.replace(/<span>Mining \(v2\)<\/span>/g, '<span>Mining</span>');

// 6. Clean up useEffect: remove old setIsMiningOpen(pathname.startsWith('/equipment/mining'));
content = content.replace(/\s*setIsMiningOpen\(pathname\.startsWith\('\/equipment\/mining'\)\);/, '');

fs.writeFileSync(file, content, 'utf8');
console.log('Sidebar updated');
