import * as TaskManager from 'expo-task-manager';
import { BACKGROUND_LOCATION_TASK } from './taskName';
import { locationDelivery } from '../location/runtime';

export { BACKGROUND_LOCATION_TASK } from './taskName';
// Module scope, before Expo Router. Defining a task never starts tracking.
if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, locationDelivery.handle);
}
