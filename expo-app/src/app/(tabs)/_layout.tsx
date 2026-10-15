import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function Emoji({ children }: { children: string }) {
  return <Text style={{ fontSize: 20 }}>{children}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#96695F',
        tabBarInactiveTintColor: '#A0938B',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#EEE4DF',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chambre',
          tabBarIcon: () => <Emoji>🏠</Emoji>,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historique',
          tabBarIcon: () => <Emoji>📈</Emoji>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Réglages',
          tabBarIcon: () => <Emoji>⚙️</Emoji>,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: () => <Emoji>📖</Emoji>,
        }}
      />
    </Tabs>
  );
}
