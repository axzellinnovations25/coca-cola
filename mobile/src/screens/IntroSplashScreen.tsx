import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

const BRAND_BG = '#0f766e';

export default function IntroSplashScreen({ onFinish }: { onFinish: () => void }) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const y = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const enter = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 520, useNativeDriver: true }),
    ]);

    const hold = Animated.delay(700);

    const exit = Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true });

    const seq = Animated.sequence([enter, hold, exit]);
    seq.start(({ finished }) => {
      if (finished) onFinish();
    });

    return () => {
      seq.stop();
    };
  }, [fade, onFinish, scale, y]);

  const styles = useMemo(() => makeStyles(), []);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.content, { opacity: fade, transform: [{ translateY: y }, { scale }] }]}>
        <View style={styles.badge}>
          <Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.title}>RepRoute</Text>
        <Text style={styles.subtitle}>Sales routes, orders, and collections</Text>
      </Animated.View>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: BRAND_BG,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    content: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      width: 148,
      height: 148,
      borderRadius: 74,
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    logo: {
      width: 132,
      height: 132,
    },
    title: {
      color: 'rgba(255,255,255,0.98)',
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: 0,
    },
    subtitle: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 15,
      fontWeight: '600',
      marginTop: 8,
      textAlign: 'center',
    },
  });

