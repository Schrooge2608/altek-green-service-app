import { collection, query, where, getDocs, Firestore } from 'firebase/firestore';

export interface EquipmentStatsData {
    breakdowns: number;
    maintenance: number;
}

// Global cache to prevent 80 queries per page
let globalStatsPromise: Promise<{ 
    fsrs: any[], 
    breakdowns: any[], 
    schedules: any[],
    year: string 
}> | null = null;

export async function fetchAllStatsForYear(db: Firestore, year: string) {
    // Return cached promise if it exists for the same year
    if (globalStatsPromise) {
        const cached = await globalStatsPromise;
        if (cached.year === year) {
            return cached;
        }
    }

    globalStatsPromise = (async () => {
        const yearStart = `${year}-01-01`;
        
        // Fetch all FSRs for the year
        const fsrSnap = await getDocs(query(collection(db, 'field_service_reports'), where('date', '>=', yearStart)));
        const fsrs = fsrSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch all breakdowns for the year
        const bdSnap = await getDocs(query(collection(db, 'breakdown_reports'), where('date', '>=', yearStart)));
        const breakdowns = bdSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch all completed schedules for the year (field is completionDate)
        const schedSnap = await getDocs(query(collection(db, 'completed_schedules'), where('completionDate', '>=', yearStart)));
        const schedules = schedSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return { fsrs, breakdowns, schedules, year };
    })();

    return globalStatsPromise;
}

export function getStatsForEquipment(cachedData: any, equipmentId: string, equipmentName: string): EquipmentStatsData {
    if (!cachedData) return { breakdowns: 0, maintenance: 0 };
    
    let bdCount = 0;
    const uniqueBds = new Set<string>();

    // Check FSRs
    cachedData.fsrs.forEach((f: any) => {
        if (f.equipmentId === equipmentId || f.assetName === equipmentName) {
            if (!uniqueBds.has(f.id)) {
                uniqueBds.add(f.id);
                bdCount++;
            }
        }
    });

    // Check Breakdowns
    cachedData.breakdowns.forEach((b: any) => {
        if (b.equipmentId === equipmentId || b.equipmentName === equipmentName) {
            if (!uniqueBds.has(b.id)) {
                uniqueBds.add(b.id);
                bdCount++;
            }
        }
    });

    // Check Maintenance
    let maintCount = 0;
    cachedData.schedules.forEach((s: any) => {
        if (s.equipmentId === equipmentId || s.equipmentName === equipmentName) {
            maintCount++;
        }
    });

    return {
        breakdowns: bdCount,
        maintenance: maintCount
    };
}
