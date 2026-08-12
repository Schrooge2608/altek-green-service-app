const fs = require('fs');
const path = require('path');

const files = [
  'src/app/mining-v2/pump-stations/mposa/page.tsx',
  'src/app/mining-v2/pump-stations/nhlabane/page.tsx',
  'src/app/mining-v2/pump-stations/monzi/page.tsx',
  'src/app/mining-v2/pump-stations/return-water/page.tsx'
];

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Change the Equipment Name Link color to text-primary
  content = content.replace(
    /className="font-bold text-slate-800 hover:underline hover:text-primary"/g,
    'className="font-bold text-primary hover:underline"'
  );

  // 2. Add the Actions TableHead right after Assigned TableHead
  if (!content.includes('>Actions</TableHead>')) {
      content = content.replace(
        /<TableHead className="font-bold text-slate-900">Assigned<\/TableHead>\s*<\/TableRow>/g,
        '<TableHead className="font-bold text-slate-900">Assigned</TableHead>\n                <TableHead className="text-right font-bold uppercase text-xs tracking-wider text-slate-500">Actions</TableHead>\n              </TableRow>'
      );
  }

  // 3. Add the handleDelete function inside the component if it doesn't exist
  if (!content.includes('const handleDelete = async')) {
      // Find where handleClearData ends
      const insertAt = content.indexOf('  const handleClearData = async');
      if (insertAt !== -1) {
          const handleDeleteStr = `
  const handleDelete = async (eqId: string, vsdId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'equipment', eqId));
      if (vsdId) {
        await deleteDoc(doc(firestore, 'vsds', vsdId));
      }
      toast({ title: "Deleted", description: "Equipment removed." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete." });
    }
  };

`;
          content = content.slice(0, insertAt) + handleDeleteStr + content.slice(insertAt);
      }
  }

  // 4. Add the Actions TableCell with Trash2
  if (!content.includes('<Trash2')) {
      // Find the end of the Assigned TableCell
      const searchStr = `</Badge>
                    </TableCell>`;
      // Let's replace the one that comes after `item.assignedTechnician`
      content = content.replace(
          /(<Badge[^>]*>\s*\{item\.assignedTechnician \|\| 'Unassigned'\}\s*<\/Badge>\s*<\/TableCell>)/g,
          `$1\n                    <TableCell className="text-right">\n                      <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(item.id, item.vsdId || '')}>\n                        <Trash2 className="h-4 w-4" />\n                      </Button>\n                    </TableCell>`
      );
  }

  fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Fixed pump station pages.');
