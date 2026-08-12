const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/mining-v2/pump-stations/return-water/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
    "import { collection, query, where, doc, deleteDoc } from 'firebase/firestore';",
    "import { collection, query, where, doc, deleteDoc, setDoc } from 'firebase/firestore';"
);

content = content.replace(
    "import { useToast } from '@/hooks/use-toast';",
    "import { useToast } from '@/hooks/use-toast';\nimport { generateUUID } from '@/lib/utils';"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed imports for Return Water seed script.');
