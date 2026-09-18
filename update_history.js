
const fs = require("fs");

const filesToUpdate = [
    "src/app/maintenance/page.tsx",
    "src/app/maintenance/unscheduled/history/page.tsx"
];

for (const file of filesToUpdate) {
    let content = fs.readFileSync(file, "utf8");
    
    if (!content.includes("import { Table")) {
        content = content.replace(
            "import { Card", 
            "import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from \"@/components/ui/table\";\nimport { Card"
        );
    }
    if (!content.includes("addMonths")) {
        content = content.replace("import { format } from \"date-fns\";", "import { format, addMonths } from \"date-fns\";");
    }

    const diaryListRegex = /function DiaryList\([^]*?\)\s*\{[\s\S]*?(?=export default function)/;
    
    const newDiaryList = `function DiaryList({ diaries, locationTag, equipmentFilter }: { diaries: DailyDiary[] | null, locationTag: string, equipmentFilter?: string }) {
    if (!diaries) return <div className="text-sm text-muted-foreground p-2">Loading...</div>;
    
    interface WorkItemRow {
        id: string;
        diaryId: string;
        date: Date;
        area: string;
        scope: string;
    }
    
    const workItems: WorkItemRow[] = [];
    
    diaries.forEach(d => {
        if (!d.locationTags?.includes(locationTag)) return;
        
        (d.works || []).forEach((w, i) => {
            if (!w.area || !w.scope) return;
            
            if (equipmentFilter && !w.area.toLowerCase().includes(equipmentFilter.toLowerCase())) {
                return;
            }

            const scopeLower = w.scope.toLowerCase();
            const areaLower = w.area.toLowerCase();
            
            const maintenanceKeywords = ["maintenance", "battery", "module", "replace", "rebuild", "service", "repair", "fix", "install"];
            const isMaintenance = maintenanceKeywords.some(k => scopeLower.includes(k) || areaLower.includes(k));
            
            const transportKeywords = ["collect", "transport", "deliver", "move"];
            const isTransport = transportKeywords.some(k => scopeLower.includes(k));
            
            if (!isMaintenance && isTransport) return;
            
            workItems.push({
                id: \`\${d.id}-\${i}\`,
                diaryId: d.id,
                date: new Date(d.date),
                area: w.area,
                scope: w.scope
            });
        });
    });

    if (workItems.length === 0) {
        return <div className="text-sm text-muted-foreground italic p-2">No maintenance work recorded for this equipment.</div>;
    }

    workItems.sort((a, b) => b.date.getTime() - a.date.getTime());

    return (
        <div className="overflow-x-auto w-full">
            <Table className="text-xs w-full bg-white border border-slate-200">
                <TableHeader className="bg-slate-100">
                    <TableRow>
                        <TableHead>Equipment / Area</TableHead>
                        <TableHead>Scope of Work</TableHead>
                        <TableHead className="w-28">Service Date</TableHead>
                        <TableHead className="w-32">Next Service Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {workItems.map(item => {
                        const nextService = addMonths(item.date, 3);
                        return (
                            <TableRow key={item.id} className="hover:bg-slate-50">
                                <TableCell className="font-medium max-w-[200px] truncate">
                                    <Link href={\`/reports/contractors-daily-diary/\${item.diaryId}\`} className="text-primary hover:underline" title="View Diary">
                                        {item.area}
                                    </Link>
                                </TableCell>
                                <TableCell>{item.scope}</TableCell>
                                <TableCell>{format(item.date, "yyyy/MM/dd")}</TableCell>
                                <TableCell className="font-bold text-emerald-700">{format(nextService, "yyyy/MM/dd")}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

`;
    content = content.replace(diaryListRegex, newDiaryList);
    
    fs.writeFileSync(file, content);
}
console.log("Done");

