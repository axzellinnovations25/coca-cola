import React from 'react';
import { Text } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import BillsCollectionsScreen from '../screens/BillsCollectionsScreen';
import CreateOrderScreen from '../screens/CreateOrderScreen';
import DashboardScreen from '../screens/DashboardScreen';
import LoginScreen from '../screens/LoginScreen';
import MyCollectionScreen from '../screens/MyCollectionScreen';
import MyOrdersScreen from '../screens/MyOrdersScreen';
import MyShopsScreen from '../screens/MyShopsScreen';
import LoadingScreen from '../screens/LoadingScreen';
import MoreMenuScreen from '../screens/MoreMenuScreen';
import { useThemeColors } from '../theme/colors';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

function MoreNavigator() {
  const colors = useThemeColors();
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.accent,
          borderBottomColor: colors.accent,
          borderBottomWidth: 0,
          shadowColor: colors.accent,
          shadowOpacity: 0.25,
          shadowRadius: 10,
          elevation: 6,
        },
        headerTintColor: colors.background,
        contentStyle: { backgroundColor: colors.background },
        headerTitle: 'S.B Distribution',
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 18,
          letterSpacing: 0.3,
          color: colors.background,
        },
        headerBackTitleVisible: false,
        headerBackTitle: '',
      }}
    >
      <MoreStack.Screen name="More" component={MoreMenuScreen} />
      <MoreStack.Screen name="My Shops" component={MyShopsScreen} />
      <MoreStack.Screen name="My Orders" component={MyOrdersScreen} />
      <MoreStack.Screen name="My Collection" component={MyCollectionScreen} />
    </MoreStack.Navigator>
  );
}

function RepTabs() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 6);
  return (
    <Tabs.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.accent,
          borderBottomColor: colors.accent,
          borderBottomWidth: 0,
          shadowColor: colors.accent,
          shadowOpacity: 0.25,
          shadowRadius: 10,
          elevation: 6,
        },
        headerTintColor: colors.background,
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 18,
          letterSpacing: 0.3,
          color: colors.background,
        },
        tabBarStyle: {
          backgroundColor: colors.surfaceAlt,
          borderTopColor: colors.borderStrong,
          borderTopWidth: 1,
          height: 56 + bottomInset,
          paddingTop: 4,
          paddingBottom: bottomInset,
          marginBottom: 0,
          marginHorizontal: 12,
          borderRadius: 14,
          paddingHorizontal: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          marginTop: 4,
        },
        tabBarItemStyle: {
          borderRadius: 0,
          marginHorizontal: 0,
          paddingVertical: 0,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarActiveBackgroundColor: colors.accentSoft,
        headerTitle: 'S.B Distribution',
      }}
    >
      <Tabs.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color }}>DB</Text> }}
      />
      <Tabs.Screen
        name="Create Order"
        component={CreateOrderScreen}
        options={{ tabBarLabel: 'Order', tabBarIcon: ({ color }) => <Text style={{ color }}>+</Text> }}
      />
      <Tabs.Screen
        name="Bills"
        component={BillsCollectionsScreen}
        options={{
          title: 'Bills & Collections',
          tabBarLabel: 'Bills',
          tabBarIcon: ({ color }) => <Text style={{ color }}>Bi</Text>,
        }}
      />
      <Tabs.Screen
        name="MoreStack"
        component={MoreNavigator}
        options={{
          title: 'More',
          headerShown: false,
          tabBarIcon: ({ color }) => <Text style={{ color }}>...</Text>,
        }}
      />
    </Tabs.Navigator>
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
          <Stack.Screen name="RepApp" component={RepTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
