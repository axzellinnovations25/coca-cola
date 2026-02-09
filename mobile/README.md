# MotionRep Rep Mobile App

React Native (Expo) app for the MotionRep representative frontend. Includes the full rep dashboard flow (dashboard, shops, orders, collections, create order) wired to the same API endpoints as the web app.

## Getting started

1) Install dependencies: `cd mobile && npm install`
2) Start Metro bundler: `npm run start`
3) Choose a target: press `a` for Android emulator/device, `i` for iOS simulator, or scan the QR code in Expo Go.

## Notes

- Entry point is `App.tsx`; screens live under `src/screens/`.
- App branding lives in `app.json` (`MotionRep Rep`).
- Native folders (`ios/`, `android/`) are ignored by default; run `npx expo prebuild` only if you need native modules.
- Configure the API base URL with `EXPO_PUBLIC_API_BASE_URL` (defaults to `http://3.81.158.4:3001`).
