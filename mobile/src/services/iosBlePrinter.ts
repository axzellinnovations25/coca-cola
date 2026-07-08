import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { Platform } from 'react-native';
import { BleManager, Characteristic, Device, State } from 'react-native-ble-plx';

export const IOS_BLE_PRINTER_ID_KEY = 'ios_ble_receipt_printer_id';
export const IOS_BLE_PRINTER_NAME_KEY = 'ios_ble_receipt_printer_name';

export interface IosBlePrinterDevice {
  deviceName: string;
  macAddress: string;
}

type WritableTarget = {
  characteristic: Characteristic;
  withoutResponse: boolean;
};

let manager: BleManager | null = null;

const COMMON_WRITE_CHARACTERISTIC_UUIDS = [
  'ffe1',
  'ffe2',
  'ff01',
  'ff02',
  'ae01',
  'ae02',
  '2af1',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getManager = () => {
  if (Platform.OS !== 'ios') {
    throw new Error('iOS Bluetooth printing is only available on iOS.');
  }
  if (!manager) {
    try {
      manager = new BleManager();
    } catch {
      throw new Error('Bluetooth printer module is unavailable. Build the app with EAS after adding BLE support.');
    }
  }
  return manager;
};

const ensureBleReady = async () => {
  const bleManager = getManager();
  const state = await bleManager.state();
  if (state === State.PoweredOn) return bleManager;
  await new Promise<void>((resolve, reject) => {
    let subscription: { remove: () => void } | null = null;
    const timeout = setTimeout(() => {
      subscription?.remove();
      reject(new Error('Turn on Bluetooth, then try again.'));
    }, 10000);
    subscription = bleManager.onStateChange((nextState) => {
      if (nextState === State.PoweredOn) {
        clearTimeout(timeout);
        subscription?.remove();
        resolve();
      }
    }, true);
  });
  return bleManager;
};

const normalizeUuid = (uuid: string) => uuid.toLowerCase();

const getDeviceName = (device: Device) =>
  device.name || device.localName || 'Bluetooth Printer';

const isLikelyPrinterName = (name: string) => {
  const value = name.toLowerCase();
  return (
    value.includes('print') ||
    value.includes('pos') ||
    value.includes('receipt') ||
    value.includes('thermal') ||
    value.includes('esc') ||
    value.includes('mpt') ||
    value.includes('rpp') ||
    value.includes('pt-') ||
    value.includes('xp-') ||
    value.includes('zj') ||
    value.includes('dbl')
  );
};

export const getSavedIosBlePrinter = async () => {
  const [id, name] = await Promise.all([
    AsyncStorage.getItem(IOS_BLE_PRINTER_ID_KEY),
    AsyncStorage.getItem(IOS_BLE_PRINTER_NAME_KEY),
  ]);
  return id ? { macAddress: id, deviceName: name || id } : null;
};

export const saveIosBlePrinter = async (printer: IosBlePrinterDevice) => {
  await AsyncStorage.multiSet([
    [IOS_BLE_PRINTER_ID_KEY, printer.macAddress],
    [IOS_BLE_PRINTER_NAME_KEY, printer.deviceName],
  ]);
};

export const scanIosBlePrinters = async (timeoutMs = 12000) => {
  const bleManager = await ensureBleReady();
  const discovered = new Map<string, IosBlePrinterDevice>();

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      bleManager.stopDeviceScan().catch(() => {});
      resolve();
    }, timeoutMs);

    bleManager
      .startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          clearTimeout(timeout);
          bleManager.stopDeviceScan().catch(() => {});
          reject(new Error(error.message || 'Could not scan for Bluetooth printers.'));
          return;
        }
        if (!device?.id) return;
        const name = getDeviceName(device);
        if (!device.name && !device.localName && !device.isConnectable) return;
        discovered.set(device.id, {
          deviceName: name,
          macAddress: device.id,
        });
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(new Error(error?.message || 'Could not start Bluetooth scan.'));
      });
  });

  return Array.from(discovered.values()).sort((a, b) => {
    const aLikely = isLikelyPrinterName(a.deviceName) ? 0 : 1;
    const bLikely = isLikelyPrinterName(b.deviceName) ? 0 : 1;
    return aLikely - bLikely || a.deviceName.localeCompare(b.deviceName);
  });
};

const findWritableCharacteristic = async (device: Device): Promise<WritableTarget> => {
  const services = await device.services();
  const writable: WritableTarget[] = [];

  for (const service of services) {
    const characteristics = await device.characteristicsForService(service.uuid);
    characteristics.forEach((characteristic) => {
      if (characteristic.isWritableWithoutResponse) {
        writable.push({ characteristic, withoutResponse: true });
      } else if (characteristic.isWritableWithResponse) {
        writable.push({ characteristic, withoutResponse: false });
      }
    });
  }

  if (!writable.length) {
    throw new Error('Printer connected, but no writable BLE characteristic was found.');
  }

  const preferred = writable.find(({ characteristic }) =>
    COMMON_WRITE_CHARACTERISTIC_UUIDS.some((uuid) => normalizeUuid(characteristic.uuid).includes(uuid)),
  );

  return preferred || writable[0];
};

const writeChunks = async (target: WritableTarget, text: string) => {
  const bytes = Buffer.from(text, 'utf8');
  const chunkSize = target.withoutResponse ? 20 : 120;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize).toString('base64');
    if (target.withoutResponse) {
      await target.characteristic.writeWithoutResponse(chunk);
      await delay(20);
    } else {
      await target.characteristic.writeWithResponse(chunk);
    }
  }
};

export const printTextWithIosBlePrinter = async (deviceId: string, text: string) => {
  const bleManager = await ensureBleReady();
  let connectedDevice: Device | null = null;

  try {
    connectedDevice = await bleManager.connectToDevice(deviceId, { timeout: 12000 });
    connectedDevice = await connectedDevice.discoverAllServicesAndCharacteristics();
    const target = await findWritableCharacteristic(connectedDevice);
    await writeChunks(target, text);
  } finally {
    if (connectedDevice) {
      bleManager.cancelDeviceConnection(connectedDevice.id).catch(() => {});
    }
  }
};

export const printReceiptLinesWithIosBlePrinter = async (deviceId: string, lines: string[]) => {
  const payload = `\x1b@\n${lines.join('\n')}\n\n`;
  await printTextWithIosBlePrinter(deviceId, payload);
};
