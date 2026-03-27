import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useThemeColors } from '../theme/colors';

function SkeletonBox({ width, height, style }: { width: any; height: number; style?: any }) {
  const colors = useThemeColors();
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: 8, backgroundColor: colors.border },
        style,
        { opacity },
      ]}
    />
  );
}

export function DashboardSkeleton() {
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12, gap: 14, backgroundColor: colors.background }}>
      {/* Header card */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <SkeletonBox width={140} height={32} style={{ borderRadius: 10 }} />
          <SkeletonBox width={80} height={28} style={{ borderRadius: 999 }} />
        </View>
        <SkeletonBox width={210} height={16} style={{ borderRadius: 6 }} />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
          <SkeletonBox width="48%" height={80} style={{ borderRadius: 16 }} />
          <SkeletonBox width="48%" height={80} style={{ borderRadius: 16 }} />
        </View>
      </View>
      {/* Stat grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBox key={i} width="48%" height={100} style={{ borderRadius: 20 }} />
        ))}
      </View>
      {/* Section card */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 18, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <SkeletonBox width={120} height={20} style={{ borderRadius: 6 }} />
          <SkeletonBox width={60} height={16} style={{ borderRadius: 6 }} />
        </View>
        {[0, 1, 2].map((i) => (
          <SkeletonBox key={i} width="100%" height={64} style={{ borderRadius: 14 }} />
        ))}
      </View>
      {/* Second section card */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 18, gap: 12 }}>
        <SkeletonBox width={140} height={20} style={{ borderRadius: 6 }} />
        {[0, 1].map((i) => (
          <SkeletonBox key={i} width="100%" height={64} style={{ borderRadius: 14 }} />
        ))}
      </View>
    </View>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header area */}
      <View
        style={{
          padding: 20,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: 12,
        }}
      >
        <SkeletonBox width={200} height={24} style={{ borderRadius: 6 }} />
        <SkeletonBox width={240} height={15} style={{ borderRadius: 6 }} />
        <SkeletonBox width="100%" height={44} style={{ borderRadius: 12 }} />
      </View>
      {/* List rows */}
      <View style={{ padding: 16, gap: 12 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <View
            key={i}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 16,
              gap: 10,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ gap: 6, flex: 1 }}>
                <SkeletonBox width={160} height={18} style={{ borderRadius: 6 }} />
                <SkeletonBox width={110} height={13} style={{ borderRadius: 5 }} />
                <SkeletonBox width={90} height={13} style={{ borderRadius: 5 }} />
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <SkeletonBox width={80} height={20} style={{ borderRadius: 6 }} />
                <SkeletonBox width={60} height={12} style={{ borderRadius: 5 }} />
              </View>
            </View>
            {/* Progress bar placeholder */}
            <SkeletonBox width="100%" height={6} style={{ borderRadius: 3 }} />
            {/* Stat boxes */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <SkeletonBox width="48%" height={50} style={{ borderRadius: 12 }} />
              <SkeletonBox width="48%" height={50} style={{ borderRadius: 12 }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
