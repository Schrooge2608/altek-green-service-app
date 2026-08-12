const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/components/layout/sidebar-nav.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove miningDivisions
content = content.replace(/const miningDivisions = \[\s*\{ href: '\/equipment\/mining\/boosters', label: 'Boosters' \},\s*\{ href: '\/equipment\/mining\/dredgers', label: 'Dredgers' \},\s*\{ href: '\/equipment\/mining\/pump-stations', label: 'Pump Stations' \},\s*\{ href: '\/equipment\/mining\/ups-btus', label: 'UPS\/BTU\\'s' \},\s*\];\n/, '');

// 2. Remove the old Mining collapsible block
const oldBlockRegex = /                            <SidebarMenuSubItem>\n                                <Collapsible open=\{isMiningOpen\} onOpenChange=\{setIsMiningOpen\} className="group\/mining">[\s\S]*?<\/SidebarMenuSubItem>\n                            \n/;
content = content.replace(oldBlockRegex, '');

// 3. Remove isMiningOpen state
content = content.replace(/  const \[isMiningOpen, setIsMiningOpen\] = useState\(false\);\n/, '');

// 4. Remove old useEffect
content = content.replace(/\s*setIsMiningOpen\(pathname\.startsWith\('\/equipment\/mining'\)\);\n/, '\n');

// 5. Rename isV2Open -> isMiningOpen
content = content.replace(/isV2Open/g, 'isMiningOpen');
content = content.replace(/setIsV2Open/g, 'setIsMiningOpen');

// 6. Change "Mining (v2)" to "Mining"
content = content.replace(/tooltip="Mining \(v2\)"/g, 'tooltip="Mining"');
content = content.replace(/<span>Mining \(v2\)<\/span>/g, '<span>Mining</span>');

// 7. Change "/mining-v2" to "/mining"
content = content.replace(/\/mining-v2/g, '/mining');

fs.writeFileSync(file, content, 'utf8');
console.log("Sidebar updated correctly");
