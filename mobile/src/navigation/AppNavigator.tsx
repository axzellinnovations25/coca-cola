import React from 'react';
import { useColorScheme, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
import SettingsScreen from '../screens/SettingsScreen';
import { useThemeColors } from '../theme/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name,
  activeName,
  color,
  focused,
  size,
}: {
  name: IoniconName;
  activeName: IoniconName;
  color: string;
  focused: boolean;
  size: number;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={focused ? activeName : name} size={size} color={color} />
      {focused && (
        <View
          style={{
            position: 'absolute',
            bottom: -6,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
      )}
    </View>
  );
}

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

function MoreNavigator() {
  const colors = useThemeColors();
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerShadowVisible: true,
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
        headerTitle: 'S.B Distribution',
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 20,
          color: colors.text,
        },
      }}
    >
      <MoreStack.Screen name="More" component={MoreMenuScreen} />
      <MoreStack.Screen name="My Shops" component={MyShopsScreen} />
      <MoreStack.Screen name="My Orders" component={MyOrdersScreen} />
      <MoreStack.Screen name="My Collection" component={MyCollectionScreen} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} />
    </MoreStack.Navigator>
  );
}

function RepTabs() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  return (
    <Tabs.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: 'transparent',
          borderBottomColor: 'transparent',
          borderBottomWidth: 0,
        },
        headerBackground: () => (
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        ),
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 20,
          letterSpacing: -0.3,
          color: '#FFFFFF',
        },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: colors.surface,
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          height: 65 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset + 4,
          paddingHorizontal: 16,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarBackground: () => null,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
          letterSpacing: 0.2,
        },
        tabBarItemStyle: {
          borderRadius: 12,
          marginHorizontal: 4,
          paddingVertical: 6,
          gap: 2,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarActiveBackgroundColor: 'transparent',
        headerTitle: 'S.B Distribution',
      }}
    >
      <Tabs.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name="grid-outline" activeName="grid" color={color} focused={focused} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="Create Order"
        component={CreateOrderScreen}
        options={{
          tabBarLabel: 'Order',
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name="add-circle-outline" activeName="add-circle" color={color} focused={focused} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="Bills"
        component={BillsCollectionsScreen}
        options={{
          title: 'Bills & Collections',
          tabBarLabel: 'Bills',
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name="wallet-outline" activeName="wallet" color={color} focused={focused} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="MoreStack"
        component={MoreNavigator}
        options={{
          title: 'More',
          headerShown: false,
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name="menu-outline" activeName="menu" color={color} focused={focused} size={size} />
          ),
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
