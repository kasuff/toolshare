import { View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInboxBadgeCount } from '../../hooks/useInboxBadgeCount';
import { TabBarBadge } from '../../components/TabBarBadge';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const inboxBadgeCount = useInboxBadgeCount();

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: 'bold' },
        tabBarActiveTintColor: Colors.brand,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 60 + (insets.bottom > 0 ? insets.bottom - 4 : 0),
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="tools"
        listeners={{
          tabPress: () => {
            router.replace('/tools');
          },
        }}
        options={{
          title: 'Werkzeuge',
          popToTopOnBlur: true,
          tabBarIcon: ({ color }) => <Ionicons name="hammer-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="workshops"
        listeners={{
          tabPress: () => {
            router.replace('/workshops');
          },
        }}
        options={{
          title: 'Werkstätten',
          popToTopOnBlur: true,
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="offers"
        options={{
          title: 'Angebote',
          tabBarIcon: ({ color }) => <Ionicons name="pricetag-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="chatbubble-outline" size={24} color={color} />
              <TabBarBadge count={inboxBadgeCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />,
        }}
      />
      
    </Tabs>
  );
}
