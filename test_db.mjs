import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';

const app = initializeApp({ projectId: 'altek-green-service-app' });
const db = getFirestore(app);
async function run() {
    const snapshot = await getDocs(query(collection(db, 'spare_parts'), limit(2)));
    snapshot.forEach(doc => console.log(doc.id, doc.data()));
    process.exit(0);
}
run();
