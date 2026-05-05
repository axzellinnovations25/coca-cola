# Rep Route Mobile App

React Native (Expo) app for the Rep Route representative frontend. Includes the full rep dashboard flow (dashboard, shops, orders, collections, create order) wired to the same API endpoints as the web app.

## Getting started

1) Install dependencies: `cd mobile && npm install`
2) Start Metro bundler: `npm run start`
3) Choose a target: press `a` for Android emulator/device, `i` for iOS simulator, or scan the QR code in Expo Go.

## Notes

- Entry point is `App.tsx`; screens live under `src/screens/`.
- App branding lives in `app.json` (`Rep Route`).
- iOS Bluetooth printing uses `react-native-ble-plx`, so it requires an EAS/dev build with native modules. It will not run in Expo Go.
- Native folders (`ios/`, `android/`) are ignored by default; run `npx expo prebuild` only if you need local native project files.
- Configure the API base URL with `EXPO_PUBLIC_API_BASE_URL` (defaults to `http://3.81.158.4:3001`).

## Android Play Store signing (AAB)

If Google Play rejects an `.aab` with “signed with the wrong key”, the keystore used by the build does not match the Play Console “upload certificate” for the app.

This repo does not store an Android keystore. For EAS builds, the signing key comes from EAS credentials for this project.

### Check which key EAS is using

1) Inspect credentials: `cd mobile && npx eas credentials -p android`
2) If you have the original upload keystore file, verify its SHA1 locally:

   `keytool -list -v -keystore <path-to-upload.jks> -alias <alias>`

### Fix (common options)

- **Use the original upload keystore (recommended):** In `npx eas credentials -p android`, choose to set/replace the Android keystore and upload the keystore that matches the SHA1 shown in Play Console.
- **If you lost the original upload keystore:** Request an **Upload key reset** in Play Console, then update EAS credentials to use the new keystore and rebuild.

After updating credentials, rebuild the production bundle with `cd mobile && npx eas build -p android --profile production`, then upload the new `.aab` to Play Console.
