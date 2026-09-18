
const fs = require("fs");

const file = "src/components/layout/sidebar-nav.tsx";
let content = fs.readFileSync(file, "utf8");

// 1. Add state variable
if (!content.includes("const [isDiaryOpen, setIsDiaryOpen]")) {
    content = content.replace(
        "const [isBreakdownsOpen, setIsBreakdownsOpen] = useState(false);",
        "const [isBreakdownsOpen, setIsBreakdownsOpen] = useState(false);\n  const [isDiaryOpen, setIsDiaryOpen] = useState(false);"
    );
}

// 2. Remove the old Daily Diary block
const oldBlockRegex = /\s*<SidebarMenuSubItem>\s*<Collapsible className="group\/diary">[\s\S]*?<\/Collapsible>\s*<\/SidebarMenuSubItem>/;
content = content.replace(oldBlockRegex, "");

// 3. Add the new top-level Daily Diary block
const newBlock = `
           <SidebarMenuItem>
               <Collapsible open={isDiaryOpen} onOpenChange={setIsDiaryOpen} className="group/diary-main">
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Daily Diary" isActive={pathname.startsWith("/reports/contractors-daily-diary") || pathname.startsWith("/reports/diary-tracker")}>
                            <Image src="/RBM.png" alt="RBM Logo" width={16} height={16} className="mr-0" />
                            <span>Daily Diary</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/diary-main:rotate-180" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <SidebarMenuSub>
                            {!isClient && (
                                <SidebarMenuSubItem>
                                    <SidebarMenuSubButton asChild isActive={pathname === "/reports/contractors-daily-diary"}>
                                        <Link href="/reports/contractors-daily-diary" prefetch={true}>New Diary</Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                            )}
                            <SidebarMenuSubItem>
                                <SidebarMenuSubButton asChild isActive={pathname === "/reports/diary-tracker"}>
                                    <Link href="/reports/diary-tracker" prefetch={true}>Diary Tracker</Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        </SidebarMenuSub>
                    </CollapsibleContent>
               </Collapsible>
           </SidebarMenuItem>
`;

// Find where to insert it: after Breakdown FSRs block ends
const insertTarget = `</SidebarMenuSubItem>
                        </SidebarMenuSub>
                    </CollapsibleContent>
                </Collapsible>
           </SidebarMenuItem>`;
           
const reportsStart = `<SidebarMenuItem>
               <Collapsible open={isReportsOpen}`;

// Wait, the Breakdown block ends right before the Reports block begins.
content = content.replace(reportsStart, newBlock + "           " + reportsStart);

fs.writeFileSync(file, content);
console.log("Done");

