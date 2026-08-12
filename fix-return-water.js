const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/mining-v2/pump-stations/return-water/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add isSeeding state
if (!content.includes('isSeeding')) {
    content = content.replace(
        /const \{ toast \} = useToast\(\);/,
        `const { toast } = useToast();\n  const [isSeeding, setIsSeeding] = useState(false);`
    );
}

// 2. Add handleSeedData
if (!content.includes('handleSeedData')) {
    const handleSeedDataStr = `
  const handleSeedData = async () => {
    if (!firestore) return;
    setIsSeeding(true);
    
    const items = [
      { name: "Booster Pump No.1", brand: "ABB", model: "ABB ACS880", assigned: "Ntokozo", category: "VSD" },
      { name: "Booster Pump No.2", brand: "ABB", model: "ABB ACS880", assigned: "Ntokozo", category: "VSD" },
      { name: "Return Water Boosters UPS", brand: "Eaton", model: "9SX", assigned: "Ntokozo", category: "UPS" },
      { name: "Return Water Boosters Cooling Unit", brand: "Daikin", model: "Split Type", assigned: "Ntokozo", category: "BTU" },
    ];

    try {
      const batchPromises = items.map(async (item) => {
        const eqId = generateUUID();
        
        if (item.category === 'UPS' || item.category === 'BTU') {
          return setDoc(doc(firestore, 'equipment', eqId), {
            id: eqId,
            name: item.name,
            location: 'Return Water Boosters',
            plant: 'Mining',
            division: 'Pump Stations',
            mcc: 'Return Water Boosters MCC',
            upsType: item.category,
            upsBrand: item.brand,
            upsModel: item.model,
            status: 'active',
            assignedToName: item.assigned
          });
        }

        const vsdId = generateUUID();
        await setDoc(doc(collection(firestore, 'vsds'), vsdId), {
          id: vsdId,
          driveType: 'VSD',
          serialNumber: 'Pending',
          equipmentId: eqId,
          model: item.model,
          manufacturer: item.brand,
          installationDate: new Date().toISOString().split('T')[0],
          status: 'active',
          assignedToName: item.assigned
        });

        return setDoc(doc(firestore, 'equipment', eqId), {
          id: eqId,
          name: item.name,
          location: 'Return Water Boosters',
          plant: 'Mining',
          division: 'Pump Stations',
          mcc: 'Return Water Boosters MCC',
          vsdId: vsdId,
          assignedToName: item.assigned,
          breakdownStatus: 'None',
          status: 'active'
        });
      });

      await Promise.all(batchPromises);
      toast({
        title: "Seed Successful",
        description: "Return Water equipment has been added.",
      });
    } catch (error) {
      console.error("Error seeding data:", error);
      toast({
        title: "Seed Failed",
        description: "Failed to add equipment.",
        variant: "destructive"
      });
    } finally {
      setIsSeeding(false);
    }
  };
`;
    content = content.replace(
        /const handleClearData = async \(\) => {/,
        `${handleSeedDataStr}\n  const handleClearData = async () => {`
    );
}

// 3. Add the Seed Data button
if (!content.includes('onClick={handleSeedData}')) {
    const seedButtonStr = `
          {(!equipmentList || equipmentList.length === 0) && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSeedData}
              disabled={isSeeding}
              className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
            >
              {isSeeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
              Seed Data
            </Button>
          )}
          <Link href={\`/equipment/new?mcc=Return Water Boosters MCC&plant=Mining&division=Pump Stations&location=Return Water Boosters\`}>`;
          
    content = content.replace(
        /<Link href=\{\`\/equipment\/new\?mcc=Return Water Boosters MCC&plant=Mining&division=Pump Stations&location=Return Water Boosters\`\}>/,
        seedButtonStr
    );
}

// Ensure setDoc and generateUUID are imported
if (!content.includes('setDoc')) {
    content = content.replace(/deleteDoc } from 'firebase\/firestore';/, "deleteDoc, setDoc } from 'firebase/firestore';");
}
if (!content.includes('generateUUID')) {
    content = content.replace(/import \{ useToast \} from '@\/hooks\/use-toast';/, "import { useToast } from '@/hooks/use-toast';\nimport { generateUUID } from '@/lib/utils';");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed Return Water seed script.');
