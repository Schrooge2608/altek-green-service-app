import sys
import re

with open('src/components/layout/sidebar-nav.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove miningDivisions
content = re.sub(r'const miningDivisions = \[\s*\{ href: \'/equipment/mining/boosters\', label: \'Boosters\' \},\s*\{ href: \'/equipment/mining/dredgers\', label: \'Dredgers\' \},\s*\{ href: \'/equipment/mining/pump-stations\', label: \'Pump Stations\' \},\s*\{ href: \'/equipment/mining/ups-btus\', label: \'UPS/BTU\\\'s\' \},\s*\];\n', '', content)

# 2. Remove the old Mining collapsible block
pattern = r'                            <SidebarMenuSubItem>\n                                <Collapsible open=\{isMiningOpen\} onOpenChange=\{setIsMiningOpen\} className="group/mining">.*?</SidebarMenuSubItem>\n                            \n'
content = re.sub(pattern, '', content, flags=re.DOTALL)

# 3. Remove isMiningOpen state
content = re.sub(r'  const \[isMiningOpen, setIsMiningOpen\] = useState\(false\);\n', '', content)

# 4. Remove old useEffect 
content = re.sub(r'\s*setIsMiningOpen\(pathname\.startsWith\(\'/equipment/mining\'\)\);\n', '\n', content)

# 5. Rename isV2Open -> isMiningOpen
content = content.replace('isV2Open', 'isMiningOpen')
content = content.replace('setIsV2Open', 'setIsMiningOpen')

# 6. Change "Mining (v2)" to "Mining"
content = content.replace('tooltip="Mining (v2)"', 'tooltip="Mining"')
content = content.replace('<span>Mining (v2)</span>', '<span>Mining</span>')

# 7. Change "/mining-v2" to "/mining" (Since I reverted sidebar-nav.tsx)
content = content.replace('/mining-v2', '/mining')

with open('src/components/layout/sidebar-nav.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Sidebar updated correctly")
