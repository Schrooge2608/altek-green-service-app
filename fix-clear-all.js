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

  // Add useUser and useDoc imports if not present
  if (!content.includes('useUser')) {
    content = content.replace(
      /import \{ useCollection, useFirestore, useMemoFirebase \} from '@\/firebase';/,
      "import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';"
    );
  }
  if (!content.includes('import type { User as AppUser }')) {
    content = content.replace(
      /import type \{ Equipment \} from '@\/lib\/types';/,
      "import type { Equipment, User as AppUser } from '@/lib/types';"
    );
  }

  // Inject user hook inside component
  if (!content.includes('useUser()')) {
    const hookInject = `  const { user } = useUser();
  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<AppUser>(userRoleRef);
  const isAdmin = userData?.role && (userData.role.includes('Admin') || userData.role.includes('Manager') || userData.role === 'Admin' || userData.role === 'System Admin');`;
    
    content = content.replace(
      /const \{ toast \} = useToast\(\);/,
      `const { toast } = useToast();\n\n${hookInject}`
    );
  }

  // Wrap the Clear All button in isAdmin check
  if (!content.includes('isAdmin && (')) {
    content = content.replace(
      /(<Button[^>]*onClick=\{handleClearData\}[^>]*>[\s\S]*?<\/Button>)/,
      '{isAdmin && (\n            $1\n          )}'
    );
  }

  fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Fixed Clear All visibility');
