const fs = require('fs');
const path = 'src/app/equipment/[id]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const target =   const fsrQuery = useMemoFirebase(() => {
    if (!eq?.name) return null;
    const prefix = eq.mcc || eq.location || eq.division || '';
    const uniqueKey = prefix ? \\ - \\ : eq.name;
    const searchKeys = Array.from(new Set([uniqueKey, eq.name]));
    return query(collection(firestore, 'field_service_reports'), or(where('equipmentId', '==', id), where('assetName', 'in', searchKeys)));
  }, [firestore, eq, id]);
  const { data: eqFsrsRaw, isLoading: fsrsLoading } = useCollection<FieldServiceReport>(fsrQuery);;

const replacement =   const fsrQueryAsset = useMemoFirebase(() => {
    if (!eq?.name) return null;
    const prefix = eq.mcc || eq.location || eq.division || '';
    const uniqueKey = prefix ? \\ - \\ : eq.name;
    const searchKeys = Array.from(new Set([uniqueKey, eq.name]));
    return query(collection(firestore, 'field_service_reports'), where('assetName', 'in', searchKeys));
  }, [firestore, eq]);
  const { data: fsrsByAsset, isLoading: fsrsAssetLoading } = useCollection<FieldServiceReport>(fsrQueryAsset);

  const fsrQueryId = useMemoFirebase(() => {
    if (!id) return null;
    return query(collection(firestore, 'field_service_reports'), where('equipmentId', '==', id));
  }, [firestore, id]);
  const { data: fsrsById, isLoading: fsrsIdLoading } = useCollection<FieldServiceReport>(fsrQueryId);

  const eqFsrsRaw = useMemo(() => {
    const all = [...(fsrsByAsset || []), ...(fsrsById || [])];
    return Array.from(new Map(all.map(item => [item.id, item])).values());
  }, [fsrsByAsset, fsrsById]);
  
  const fsrsLoading = fsrsAssetLoading || fsrsIdLoading;;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully replaced');
} else {
    console.log('Target not found. Here is what is in the file:');
    console.log(content.substring(content.indexOf('const fsrQuery'), content.indexOf('const fsrQuery') + 600));
}
