const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/components/layout/sidebar-nav.tsx');
let content = fs.readFileSync(file, 'utf8');

// Change Mining Equipment -> Mining
content = content.replace(/tooltip="Mining Equipment"/g, 'tooltip="Mining"');
content = content.replace(/<span>Mining Equipment<\/span>/g, '<span>Mining</span>');

// Change Mining Equipment (v2) -> Mining (v2)
content = content.replace(/tooltip="Mining Equipment \(v2\)"/g, 'tooltip="Mining (v2)"');
content = content.replace(/<span>Mining Equipment \(v2\)<\/span>/g, '<span>Mining (v2)</span>');

// Change Smelter Equipment -> Smelter
content = content.replace(/tooltip="Smelter Equipment"/g, 'tooltip="Smelter"');
content = content.replace(/<span>Smelter Equipment<\/span>/g, '<span>Smelter</span>');

// Change Smelter Equipment (v2) -> Smelter (v2)
content = content.replace(/tooltip="Smelter Equipment \(v2\)"/g, 'tooltip="Smelter (v2)"');
content = content.replace(/<span>Smelter Equipment \(v2\)<\/span>/g, '<span>Smelter (v2)</span>');

// Change Smelter sub-menu item -> Smelter Plant
// It looks like:
// <SidebarMenuSubButton asChild isActive={pathname === '/smelter-v2/smelter'}>
//     <Link href="/smelter-v2/smelter" prefetch={true}>
//         <Factory className="h-4 w-4 mr-2" />
//         <span>Smelter</span>
//     </Link>
// </SidebarMenuSubButton>
content = content.replace(
  /<span>Smelter<\/span>\s*<\/Link>\s*<\/SidebarMenuSubButton>\s*<\/SidebarMenuSubItem>/,
  '<span>Smelter Plant</span>\n                                                    </Link>\n                                                </SidebarMenuSubButton>\n                                            </SidebarMenuSubItem>'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Sidebar updated');
