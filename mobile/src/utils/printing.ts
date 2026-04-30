import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import { Platform } from 'react-native';

export const IOS_PRINTER_URL_KEY = 'ios_receipt_printer_url';
export const IOS_PRINTER_NAME_KEY = 'ios_receipt_printer_name';

type IosReceiptPrintOptions = {
  title: string;
  lines: string[];
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildReceiptHtml = ({ title, lines }: IosReceiptPrintOptions) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page {
        margin: 8mm;
      }
      * {
        box-sizing: border-box;
      }
      html,
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #111111;
      }
      .receipt {
        width: 72mm;
        max-width: 100%;
      }
      pre {
        margin: 0;
        font-family: "Courier New", Menlo, monospace;
        font-size: 11px;
        line-height: 1.35;
        white-space: pre-wrap;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <main class="receipt">
      <pre>${escapeHtml(lines.join('\n'))}</pre>
    </main>
  </body>
</html>`;

export const getSavedIosPrinterName = async () => {
  return AsyncStorage.getItem(IOS_PRINTER_NAME_KEY);
};

export const selectIosPrinter = async () => {
  if (Platform.OS !== 'ios') {
    throw new Error('iOS printer selection is only available on iOS.');
  }
  const printer = await Print.selectPrinterAsync();
  await AsyncStorage.multiSet([
    [IOS_PRINTER_URL_KEY, printer.url],
    [IOS_PRINTER_NAME_KEY, printer.name],
  ]);
  return printer;
};

export const printReceiptLinesOnIos = async (options: IosReceiptPrintOptions) => {
  if (Platform.OS !== 'ios') {
    throw new Error('iOS printing is only available on iOS.');
  }
  const printerUrl = await AsyncStorage.getItem(IOS_PRINTER_URL_KEY);
  await Print.printAsync({
    html: buildReceiptHtml(options),
    printerUrl: printerUrl || undefined,
    orientation: Print.Orientation.portrait,
    margins: {
      top: 24,
      right: 24,
      bottom: 24,
      left: 24,
    },
  });
};
