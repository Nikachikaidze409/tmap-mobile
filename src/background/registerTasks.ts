/** Reserved native task name. This module is imported before Expo Router.
 * Next increment: add module-scope TaskManager.defineTask here and delegate to
 * a headless handler. Do not register tasks inside a component or start tracking
 * during module evaluation. No location permission is requested in this build.
 */
export const BACKGROUND_LOCATION_TASK = 'tmap.background-location.v1';
