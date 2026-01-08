import { addDays, addMonths, differenceInDays, format, isBefore, startOfDay } from 'date-fns';
import type { Equipment, MaintenanceTask } from './types';

const frequencies: { name: MaintenanceTask['frequency']; days: number; task: string }[] = [
  { name: 'Weekly', days: 7, task: 'Perform weekly inspection' },
  { name: 'Monthly', days: 30, task: 'Perform monthly service' },
  { name: '3-Monthly', days: 90, task: 'Perform 3-monthly checks' },
  { name: '6-Monthly', days: 180, task: 'Perform 6-monthly overhaul' },
  { name: 'Yearly', days: 365, task: 'Perform annual major service' },
];

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
 * Generates all potential maintenance tasks for a single piece of equipment.
 * @param equipment - The equipment to generate tasks for.
 * @returns An array of MaintenanceTask objects.
 */
export function generateTasksForEquipment(equipment: Equipment): MaintenanceTask[] {
  const tasks: MaintenanceTask[] = [];
  const today = startOfDay(new Date());
  
  // Use last maintenance date if available, otherwise fall back to installation date
  const baseDate = equipment.lastMaintenance 
    ? startOfDay(new Date(equipment.lastMaintenance))
    : startOfDay(new Date(equipment.installationDate || new Date()));

  frequencies.forEach(freq => {
    const nextDueDate = getNextDueDate(baseDate, freq.days);
    const daysUntilDue = differenceInDays(nextDueDate, today);
    
    let status: MaintenanceTask['status'] = 'pending';
    if (daysUntilDue < 0) {
      status = 'overdue';
    } else if (daysUntilDue <= 7) {
      status = 'pending'; // Highlight tasks due within a week
    }

    // We only generate tasks that are overdue or due within the next cycle.
    // This prevents the UI from being cluttered with tasks far in the future.
    if (isBefore(nextDueDate, addDays(today, freq.days))) {
       tasks.push({
        id: `${equipment.id}-${freq.name.toLowerCase()}`,
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        task: freq.task,
        dueDate: format(nextDueDate, 'yyyy-MM-dd'),
        frequency: freq.name,
        status: status,
      });
    }
  });

  return tasks;
}
