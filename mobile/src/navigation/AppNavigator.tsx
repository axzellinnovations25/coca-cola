import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import CreateOrderScreen from '../screens/CreateOrderScreen';
import LoginScreen from '../screens/LoginScreen';
import MyCollectionScreen from '../screens/MyCollectionScreen';
import MyOrdersScreen from '../screens/MyOrdersScreen';
import LoadingScreen from '../screens/LoadingScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { ThemeColors, useThemeColors } from '../theme/colors';

type RepSection = 'Shop Operations' | 'My Collections' | 'My Orders' | 'Settings';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const drawerItems: Array<{
  section: RepSection;
  icon: IoniconName;
  activeIcon: IoniconName;
  description: string;
}> = [
  {
    section: 'Shop Operations',
    icon: 'storefront-outline',
    activeIcon: 'storefront',
    description: 'Order, collect, and return',
  },
  {
    section: 'My Collections',
    icon: 'wallet-outline',
    activeIcon: 'wallet',
    description: 'Payment collection history',
  },
  {
    section: 'My Orders',
    icon: 'receipt-outline',
    activeIcon: 'receipt',
    description: 'Orders and pending sales',
  },
  {
    section: 'Settings',
    icon: 'settings-outline',
    activeIcon: 'settings',
    description: 'App information and support',
  },
];

const Stack = createNativeStackNavigator();

function RepAppShell() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [section, setSection] = useState<RepSection>('Shop Operations');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectSection = (nextSection: RepSection) => {
    setSection(nextSection);
    setDrawerOpen(false);
  };

  const confirmLogout = () => {
    setDrawerOpen(false);
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={styles.shell}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open navigation menu"
          style={styles.menuButton}
          onPress={() => setDrawerOpen(true)}
        >
          <Ionicons name="menu" size={25} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerBrand}>S.B Distribution</Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.content, { paddingBottom: insets.bottom }]}>
          <View
            pointerEvents={section === 'Shop Operations' ? 'auto' : 'none'}
            style={[StyleSheet.absoluteFill, section !== 'Shop Operations' && styles.hidden]}
          >
            <CreateOrderScreen />
          </View>
          {section === 'My Collections' ? <MyCollectionScreen /> : null}
          {section === 'My Orders' ? <MyOrdersScreen /> : null}
          {section === 'Settings' ? <SettingsScreen /> : null}
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={drawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={styles.drawerLayer}>
          <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)} />
          <View
            style={[
              styles.drawer,
              {
                paddingTop: insets.top + 12,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <View style={styles.drawerHeader}>
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                style={styles.drawerLogo}
              >
                <Text style={styles.drawerLogoText}>SB</Text>
              </LinearGradient>
              <View style={styles.drawerIdentity}>
                <Text style={styles.drawerTitle}>Rep Route</Text>
                <Text style={styles.drawerUser} numberOfLines={1}>
                  {user?.first_name || user?.email || 'Sales Representative'}
                </Text>
              </View>
              <TouchableOpacity style={styles.drawerClose} onPress={() => setDrawerOpen(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.drawerNav}>
              {drawerItems.map((item) => {
                const active = section === item.section;
                return (
                  <TouchableOpacity
                    key={item.section}
                    style={[styles.drawerItem, active && styles.drawerItemActive]}
                    onPress={() => selectSection(item.section)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.drawerItemIcon, active && styles.drawerItemIconActive]}>
                      <Ionicons
                        name={active ? item.activeIcon : item.icon}
                        size={21}
                        color={active ? colors.accent : colors.textMuted}
                      />
                    </View>
                    <View style={styles.drawerItemText}>
                      <Text style={[styles.drawerItemTitle, active && styles.drawerItemTitleActive]}>
                        {item.section}
                      </Text>
                      <Text style={styles.drawerItemDescription}>{item.description}</Text>
                    </View>
                    {active ? (
                      <View style={styles.activeDot} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.drawerFooter}>
              <TouchableOpacity style={styles.logoutItem} onPress={confirmLogout}>
                <View style={[styles.drawerItemIcon, { backgroundColor: colors.dangerSurface }]}>
                  <Ionicons name="log-out-outline" size={21} color={colors.danger} />
                </View>
                <Text style={styles.logoutText}>Log Out</Text>
              </TouchableOpacity>
              <Text style={styles.drawerVersion}>S.B Distribution mobile</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const scheme = useColorScheme();
  const colors = useThemeColors();
  const navTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoading ? (
          <Stack.Screen name="Loading" component={LoadingScreen} />
        ) : isAuthenticated ? (
          <Stack.Screen name="RepApp" component={RepAppShell} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    shell: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingBottom: 9,
      gap: 10,
      elevation: 5,
      shadowColor: '#000',
      shadowOpacity: 0.14,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 3 },
    },
    menuButton: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    headerText: {
      flex: 1,
    },
    headerBrand: {
      color: '#fff',
      fontSize: 17,
      fontWeight: '900',
      letterSpacing: -0.2,
    },
    content: {
      flex: 1,
      backgroundColor: colors.background,
    },
    hidden: {
      display: 'none',
    },
    drawerLayer: {
      flex: 1,
      flexDirection: 'row',
    },
    drawerBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(7,12,24,0.58)',
    },
    drawer: {
      width: '82%',
      maxWidth: 340,
      height: '100%',
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      borderTopRightRadius: 22,
      borderBottomRightRadius: 22,
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 16,
      shadowOffset: { width: 7, height: 0 },
      elevation: 18,
    },
    drawerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingHorizontal: 4,
      paddingBottom: 18,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    drawerLogo: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    drawerLogoText: {
      color: '#fff',
      fontSize: 17,
      fontWeight: '900',
    },
    drawerIdentity: {
      flex: 1,
      gap: 2,
    },
    drawerTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
    },
    drawerUser: {
      color: colors.textMuted,
      fontSize: 11,
    },
    drawerClose: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    drawerNav: {
      gap: 7,
      paddingTop: 16,
    },
    drawerItem: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingHorizontal: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    drawerItemActive: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.borderStrong,
    },
    drawerItemIcon: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    drawerItemIconActive: {
      backgroundColor: colors.surface,
    },
    drawerItemText: {
      flex: 1,
      gap: 2,
    },
    drawerItemTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    drawerItemTitleActive: {
      color: colors.accent,
    },
    drawerItemDescription: {
      color: colors.textMuted,
      fontSize: 10,
    },
    activeDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    drawerFooter: {
      marginTop: 'auto',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
      gap: 12,
    },
    logoutItem: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingHorizontal: 10,
      borderRadius: 13,
      backgroundColor: colors.dangerSurface,
    },
    logoutText: {
      color: colors.danger,
      fontWeight: '800',
    },
    drawerVersion: {
      color: colors.textMuted,
      fontSize: 10,
      textAlign: 'center',
    },
  });
