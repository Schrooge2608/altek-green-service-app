
import { addDays, addMonths, differenceInDays, format, isBefore, startOfDay } from 'date-fns';
import type { Equipment, MaintenanceTask, VSD } from './types';

export type MaintenanceCategory = 'VSDs' | 'Protection' | 'Motors' | 'Pumps';

const frequencies: { name: MaintenanceTask['frequency']; days: number }[] = [
  { name: 'Weekly', days: 7 },
  { name: 'Monthly', days: 30 },
  { name: '3-Monthly', days: 90 },
  { name: '6-Monthly', days: 180 },
  { name: 'Yearly', days: 365 },
];

const tasksByCategory: Record<MaintenanceCategory, { task: string, component: MaintenanceTask['component'] }> = {
    'VSDs': { task: 'Perform VSD inspection', component: 'VSD' },
    'Protection': { task: 'Perform protection system check', component: 'Protection' },
    'Motors': { task: 'Perform motor inspection', component: 'Motor' },
    'Pumps': { task: 'Perform pump service', component: 'Pump' },
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
 * @param vsd - The VSD associated with the equipment.
 * @returns An array of MaintenanceTask objects.
 */
export function generateTasksForEquipment(equipment: Equipment, vsd: VSD | undefined): MaintenanceTask[] {
  const tasks: MaintenanceTask[] = [];
  const today = startOfDay(new Date());
  
  // Use last maintenance date if available, otherwise fall back to installation date from the VSD
  const baseDate = equipment.lastMaintenance 
    ? startOfDay(new Date(equipment.lastMaintenance))
    : startOfDay(new Date(vsd?.installationDate || new Date()));

  // Determine which categories apply to this equipment
  const applicableCategories: MaintenanceCategory[] = ['VSDs', 'Protection', 'Motors'];
  if (equipment.type === 'Pump') {
      applicableCategories.push('Pumps');
  }

  applicableCategories.forEach(category => {
    const categoryInfo = tasksByCategory[category];
    
    frequencies.forEach(freq => {
        const nextDueDate = getNextDueDate(baseDate, freq.days);
        const daysUntilDue = differenceInDays(nextDueDate, today);
        
        let status: MaintenanceTask['status'] = 'pending';
        if (daysUntilDue < 0) {
          status = 'overdue';
        }

        // We only generate tasks that are overdue or due within the next cycle.
        if (isBefore(nextDueDate, addDays(today, freq.days))) {
            let assignedToId = '';
            let assignedToName = '';

            // Automatically assign based on component type
            switch (categoryInfo.component) {
                case 'VSD':
                    assignedToId = vsd?.assignedToId || '';
                    assignedToName = vsd?.assignedToName || '';
                    break;
                case 'Protection':
                    assignedToId = equipment.protectionAssignedToId || '';
                    assignedToName = equipment.protectionAssignedToName || '';
                    break;
                case 'Motor':
                    assignedToId = equipment.motorAssignedToId || '';
                    assignedToName = equipment.motorAssignedToName || '';
                    break;
                case 'Pump': // Assuming overall assignee handles pumps
                default:
                    assignedToId = equipment.assignedToId || '';
                    assignedToName = equipment.assignedToName || '';
                    break;
            }

            tasks.push({
                id: `${equipment.id}-${category.toLowerCase()}-${freq.name.toLowerCase()}`,
                equipmentId: equipment.id,
                equipmentName: equipment.name,
                component: categoryInfo.component,
                task: `${categoryInfo.task} (${freq.name})`,
                dueDate: format(nextDueDate, 'yyyy-MM-dd'),
                frequency: freq.name,
                status: status,
                assignedToId: assignedToId,
                assignedToName: assignedToName,
            });
        }
    });
  });

  return tasks;
}
