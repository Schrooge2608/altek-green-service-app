const fs = require('fs');

const filePath = 'src/app/purchase-orders/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Update React imports
content = content.replace(
  "import React, { useState, useMemo } from 'react';",
  "import React, { useState, useMemo, useEffect } from 'react';"
);

// Update Lucide imports
content = content.replace(
  "  Pencil,\n  Save\n} from 'lucide-react';",
  "  Pencil,\n  Save,\n  ChevronDown,\n  ChevronRight\n} from 'lucide-react';"
);

// Add grouping state and logic
const groupingLogic = `
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  const toggleMonth = (monthStr: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthStr]: !prev[monthStr]
    }));
  };

  const filteredPOs = useMemo(() => {
    if (!purchaseOrders) return [];
    return purchaseOrders.filter(po => 
      po.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.uploadedBy?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [purchaseOrders, searchTerm]);

  const groupedPOs = useMemo(() => {
    const groups: { monthStr: string, items: PurchaseOrder[] }[] = [];
    filteredPOs.forEach(po => {
        let monthStr = 'Unknown Date';
        if (po.calloutDate) {
            const dateObj = new Date(po.calloutDate);
            if (!isNaN(dateObj.getTime())) {
                monthStr = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            }
        }
        
        let group = groups.find(g => g.monthStr === monthStr);
        if (!group) {
          group = { monthStr, items: [] };
          groups.push(group);
        }
        group.items.push(po);
    });
    return groups;
  }, [filteredPOs]);

  useEffect(() => {
    if (groupedPOs.length > 0 && Object.keys(expandedMonths).length === 0) {
      setExpandedMonths({ [groupedPOs[0].monthStr]: true });
    }
  }, [groupedPOs, expandedMonths]);
`;

// Replace filteredPOs block
content = content.replace(
  /const filteredPOs = useMemo\(\(\) => \{[\s\S]*?\}, \[purchaseOrders, searchTerm\]\);/,
  groupingLogic.trim()
);

// Replace rendering block
const oldRenderBlock = `
                ) : filteredPOs.length > 0 ? (
                  filteredPOs.map((po) => (
                    <TableRow key={po.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="pl-6 font-mono font-bold text-primary">
`.trim();

const newRenderBlock = `
                ) : groupedPOs.length > 0 ? (
                  groupedPOs.map(group => {
                    const isExpanded = expandedMonths[group.monthStr] ?? false;
                    return (
                      <React.Fragment key={group.monthStr}>
                        <TableRow 
                          className="bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
                          onClick={() => toggleMonth(group.monthStr)}
                        >
                          <TableCell colSpan={5} className="font-bold text-slate-800 py-2 pl-6 shadow-[inset_0_1px_0_rgba(0,0,0,0.05),inset_0_-1px_0_rgba(0,0,0,0.05)]">
                            <div className="flex items-center gap-2 select-none">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {group.monthStr}
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && group.items.map((po) => (
                          <TableRow key={po.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="pl-6 font-mono font-bold text-primary">
`.trim();

content = content.replace(oldRenderBlock, newRenderBlock);

const endOfMapReplace = `
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
`.trim();

const endOfMapNew = `
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  </React.Fragment>
                );
              })
                ) : (
`.trim();

content = content.replace(endOfMapReplace, endOfMapNew);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done");
