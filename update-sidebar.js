const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/components/layout/sidebar-nav.tsx');
let content = fs.readFileSync(file, 'utf8');

// Add Flame icon
if (!content.includes('Flame')) {
    content = content.replace('Activity', 'Activity,\n  Flame');
}

// Add state
if (!content.includes('isSmelterV2Open')) {
    content = content.replace(
        'const [isSmelterOpen, setIsSmelterOpen] = useState(false);',
        'const [isSmelterOpen, setIsSmelterOpen] = useState(false);\n  const [isSmelterV2Open, setIsSmelterV2Open] = useState(false);'
    );
}

// Update useEffect
if (!content.includes('setIsSmelterV2Open(')) {
    content = content.replace(
        "setIsSmelterOpen(pathname.startsWith('/equipment/smelter'));",
        "setIsSmelterOpen(pathname.startsWith('/equipment/smelter'));\n    setIsSmelterV2Open(pathname.startsWith('/smelter-v2'));"
    );
}

// Update Assets open condition
if (!content.includes("pathname.startsWith('/smelter-v2')")) {
    content = content.replace(
        "setIsAssetsOpen(pathname.startsWith('/equipment') || pathname.startsWith('/smelter') || pathname.startsWith('/assets') || pathname.startsWith('/mining-v2'));",
        "setIsAssetsOpen(pathname.startsWith('/equipment') || pathname.startsWith('/smelter') || pathname.startsWith('/assets') || pathname.startsWith('/mining-v2') || pathname.startsWith('/smelter-v2'));"
    );
    content = content.replace(
        "isActive={pathname.startsWith('/equipment') || pathname.startsWith('/smelter') || pathname.startsWith('/assets') || pathname.startsWith('/mining-v2')}",
        "isActive={pathname.startsWith('/equipment') || pathname.startsWith('/smelter') || pathname.startsWith('/assets') || pathname.startsWith('/mining-v2') || pathname.startsWith('/smelter-v2')}"
    );
}

// Inject HTML
if (!content.includes('Smelter Equipment (v2)')) {
    const htmlToInject = `
                            {/* Smelter Equipment (v2) Parallel Category - NESTED IN ASSETS */}
                            <SidebarMenuSubItem>
                                <Collapsible open={isSmelterV2Open} onOpenChange={setIsSmelterV2Open} className="group/smelterv2">
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuSubButton tooltip="Smelter Equipment (v2)" isActive={pathname.startsWith('/smelter-v2')}>
                                            <Flame className="h-4 w-4 mr-2" />
                                            <span>Smelter Equipment (v2)</span>
                                            <ChevronDown className="ml-auto h-3 w-3 transition-transform group-data-[state=open]/smelterv2:rotate-180" />
                                        </SidebarMenuSubButton>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarMenuSub>
                                            <SidebarMenuSubItem>
                                                <SidebarMenuSubButton asChild isActive={pathname === '/smelter-v2/furnaces'}>
                                                    <Link href="/smelter-v2/furnaces" prefetch={true}>
                                                        <Flame className="h-4 w-4 mr-2" />
                                                        <span>Furnaces</span>
                                                    </Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        </SidebarMenuSub>
                                    </CollapsibleContent>
                                </Collapsible>
                            </SidebarMenuSubItem>
`;
    // Find where to inject it (before the Smelter Equipment collapsible block)
    content = content.replace(
        /(<SidebarMenuSubItem>\s*<Collapsible open=\{isSmelterOpen\})/,
        htmlToInject + '$1'
    );
}

fs.writeFileSync(file, content, 'utf8');
console.log('Done');
