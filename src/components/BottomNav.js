import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Map, MapPin, BarChart2, History, Settings } from 'lucide-react-native';

export default function BottomNav({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'map', label: 'Map', Icon: Map },
    { id: 'stops', label: 'Stops', Icon: MapPin },
    { id: 'analytics', label: 'Analytics', Icon: BarChart2 },
    { id: 'history', label: 'History', Icon: History },
    { id: 'settings', label: 'Settings', Icon: Settings }
  ];

  return (
    <View style={styles.container}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        const TabIcon = tab.Icon;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabButton}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel={`${tab.label} tab`}
            accessibilityState={{ selected: isActive }}
            accessibilityHint={`Navigates to ${tab.label} screen`}
          >
            <View style={[styles.iconWrapper, isActive && styles.activeIconWrapper]}>
              <TabIcon size={20} color={isActive ? '#3b82f6' : '#94a3b8'} />
            </View>
            <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingBottom: 8,
    paddingTop: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    padding: 4,
    borderRadius: 8,
    marginBottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconWrapper: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  tabLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#3b82f6',
    fontWeight: 'bold',
  }
});
