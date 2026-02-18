import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import DashboardScreen from "../screens/DashboardScreen";
import UsageScreen from "../screens/UsageScreen";
import AlertsScreen from "../screens/AlertsScreen";
import HistoryScreen from "../screens/HistoryScreen";

const Tab = createBottomTabNavigator();

export default function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: "#00e5ff",
        tabBarInactiveTintColor: "#7a869a",
        tabBarStyle: {
          backgroundColor: "#0b0f1a",
          borderTopWidth: 0,
          height: 60,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case "Dashboard":
              iconName = focused ? "speedometer" : "speedometer-outline";
              break;
            case "Usage":
              iconName = focused ? "bar-chart" : "bar-chart-outline";
              break;
            case "Alerts":
              iconName = focused ? "warning" : "warning-outline";
              break;
            case "History":
              iconName = focused ? "time" : "time-outline";
              break;
            default:
              iconName = "ellipse";
          }

          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Usage" component={UsageScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
    </Tab.Navigator>
  );
}
