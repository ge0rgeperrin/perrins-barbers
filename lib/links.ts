/**
 * Leaving the app: phone, maps, social, and the hosted scheduler we fall back to
 * when our own booking flow cannot finish the job.
 */
import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { color } from '../theme';

export const HOSTED_SCHEDULER = 'https://perrins1.schedulista.com/';

export async function openExternal(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  await Linking.openURL(url);
}

/**
 * The escape hatch. Only used when the booking flow itself has failed — on a
 * phone this is the system browser sheet, which keeps the padlock and autofill.
 */
export async function openHostedScheduler(url: string = HOSTED_SCHEDULER): Promise<void> {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  await WebBrowser.openBrowserAsync(url, {
    toolbarColor: color.ink,
    controlsColor: color.gold,
    enableBarCollapsing: true,
    dismissButtonStyle: 'close',
  });
}
