import { Platform } from 'react-native';
import {
  getSavedIosBlePrinter,
  printReceiptLinesWithIosBlePrinter,
  saveIosBlePrinter,
  scanIosBlePrinters,
} from '../services/iosBlePrinter';

export interface IosSelectedPrinter {
  id: string;
  name: string;
}

export const getSavedIosPrinterName = async () => {
  if (Platform.OS !== 'ios') return null;
  const saved = await getSavedIosBlePrinter();
  return saved?.deviceName || null;
};

export const selectIosPrinter = async (): Promise<IosSelectedPrinter> => {
  if (Platform.OS !== 'ios') {
    throw new Error('Printer selection is only supported on iOS.');
  }

  const discovered = await scanIosBlePrinters();
  if (!discovered.length) {
    throw new Error('No Bluetooth printers found. Turn on Bluetooth and try again.');
  }

  const chosen = discovered[0];
  await saveIosBlePrinter(chosen);
  return { id: chosen.macAddress, name: chosen.deviceName };
};

export const printReceiptLinesOnIos = async (args: { title?: string; lines: string[] }) => {
  if (Platform.OS !== 'ios') {
    throw new Error('iOS printing is only available on iOS.');
  }

  const saved = await getSavedIosBlePrinter();
  if (!saved?.macAddress) {
    throw new Error('No iOS printer selected. Scan and select a printer first.');
  }

  const normalizedLines = [
    ...(args.title ? [args.title, ''] : []),
    ...args.lines,
  ].filter((line) => typeof line === 'string');

  await printReceiptLinesWithIosBlePrinter(saved.macAddress, normalizedLines);
};

