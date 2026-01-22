
import { addDays, addMonths, differenceInDays, format, isBefore, startOfDay } from 'date-fns';
import type { Equipment, MaintenanceTask } from './types';

export type MaintenanceCategory = 'VSDs' | 'Protection' | 'Motors' | 'Pumps' | 'UPS/BTU\'s';

const frequencies: { name: MaintenanceTask['frequency']; days: number }[] = [
  { name: '3-Monthly', days: 90 },
  { name: '6-Monthly', days: 180 },
  { name: 'Yearly', days: 365 },
];

const tasksByCategory: Record<MaintenanceCategory, { task: string, component: MaintenanceTask['component'] }> = {
    'VSDs': { task: 'Perform VSD inspection', component: 'VSD' },
    'Protection': { task: 'Perform protection system check', component: 'Protection' },
    'Motors': { task: 'Perform motor inspection', component: 'Motor' },
    'Pumps': { task: 'Perform pump service', component: 'Pump' },
    'UPS/BTU\'s': { task: 'Perform UPS/BTU inspection', component: 'UPS' },
};


/**
 * Calculates the next due date for a task.
 * @param lastServiceDate - The date of the last service.
 * @param days - The frequency in days.
 * @returns The next due date.
 */
function getNextDueDate(lastServiceDate: Date, days: number): Date {
  if (days <= 30) {
    return addDays(lastServiceDate, days);
  }
  // For monthly and longer, it's more intuitive to add months
  const months = Math.round(days / 30);
  return addMonths(lastServiceDate, months);
}

/**
 * Generates all potential maintenance tasks for a single piece of equipment across all categories.
 * @param equipment - The equipment to generate tasks for.
 * @returns An array of MaintenanceTask objects.
 */
export function generateTasksForEquipment(equipment: Equipment): MaintenanceTask[] {
  const tasks: MaintenanceTask[] = [];
  const today = startOfDay(new Date());
  
  const baseDate = equipment.lastMaintenance 
    ? startOfDay(new Date(equipment.lastMaintenance))
    : startOfDay(new Date(equipment.installationDate || new Date()));

  // Determine which categories apply to this equipment
  const applicableCategories: MaintenanceCategory[] = ['VSDs'];
  if (equipment.breakerAssetNumber) applicableCategories.push('Protection');
  if (equipment.motorModel) applicableCategories.push('Motors');
  if (equipment.pumpBrand) applicableCategories.push('Pumps');
  if (equipment.upsModel) applicableCategories.push('UPS/BTU\'s');
  
  applicableCategories.forEach(category => {
    const categoryInfo = tasksByCategory[category];
    
    frequencies.forEach(freq => {
        const nextDueDate = getNextDueDate(baseDate, freq.days);
        const daysUntilDue = differenceInDays(nextDueDate, today);
        
        let status: MaintenanceTask['status'] = 'pending';
        if (daysUntilDue < 0) {
          status = 'overdue';
        }

        if (isBefore(nextDueDate, addDays(today, freq.days))) {
            tasks.push({
                id: `${equipment.id}-${category.toLowerCase()}-${freq.name.toLowerCase()}`,
                equipmentId: equipment.id,
                equipmentName: equipment.name,
                component: categoryInfo.component,
                task: `${categoryInfo.task} (${freq.name})`,
                dueDate: format(nextDueDate, 'yyyy-MM-dd'),
                frequency: freq.name,
                status: status,
                assignedToId: equipment.assignedToId || '',
                assignedToName: equipment.assignedToName || '',
            });
        }
    });
  });

  return tasks;
}
