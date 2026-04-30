import 'react-native-gesture-handler';

import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { View, useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import IntroSplashScreen from './src/screens/IntroSplashScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const scheme = useColorScheme();
  const [showIntro, setShowIntro] = useState(true);
  const [rootLaidOut, setRootLaidOut] = useState(false);

  const onRootLayout = useCallback(() => {
    if (rootLaidOut) return;
    setRootLaidOut(true);
    SplashScreen.hideAsync().catch(() => {});
  }, [rootLaidOut]);

  return (
    <AuthProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1 }} onLayout={onRootLayout}>
        {showIntro ? <IntroSplashScreen onFinish={() => setShowIntro(false)} /> : <AppNavigator />}
      </View>
    </AuthProvider>
  );
}
