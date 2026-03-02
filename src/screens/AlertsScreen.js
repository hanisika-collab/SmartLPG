// Professional Safety Dashboard UI - AlertsScreen
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db, auth } from "../firebase";

// Keeping your existing styles, updating the logic
export default function AlertsScreen() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "alerts", auth.currentUser.uid, "logs"), orderBy("timestamp", "desc"));
    return onSnapshot(q, (snap) => {
      setAlerts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const getColor = (severity) => {
    if (severity === "CRITICAL") return ["#7f1d1d", "#dc2626"];
    if (severity === "WARNING") return ["#78350f", "#f59e0b"];
    return ["#1e3a8a", "#2563eb"];
  };

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={["#020617", "#0f172a"]} style={styles.header}>
        <Text style={styles.headerBig}>Safety Alerts</Text>
      </LinearGradient>

      {alerts.length === 0 ? (
        <View style={styles.emptyBox}><Text style={styles.emptyText}>All systems normal.</Text></View>
      ) : (
        alerts.map((alert) => (
          <LinearGradient key={alert.id} colors={getColor(alert.severity)} style={styles.alertCard}>
            <Text style={styles.alertSeverity}>{alert.severity}</Text>
            <Text style={styles.alertTitle}>{alert.type.replace(/_/g, ' ')}</Text>
            <Text style={styles.alertMsg}>{alert.message}</Text>
          </LinearGradient>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },

  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  headerSmall: { color: "#38bdf8", fontSize: 12, fontWeight: "700" },
  headerBig: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 4 },
  headerSub: { color: "#cbd5f5", marginTop: 6, fontSize: 13 },

  emergencyCard: {
    margin: 16,
    borderRadius: 24,
    padding: 20,
  },
  emergencyTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  emergencyText: { color: "#fee2e2", marginTop: 6, fontSize: 13, lineHeight: 18 },
  emergencyButton: {
    backgroundColor: "#dc2626",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 14,
    alignItems: "center",
  },
  emergencyBtnText: { color: "#fff", fontWeight: "900", letterSpacing: 1 },

  sectionTitle: {
    color: "#38bdf8",
    fontSize: 15,
    fontWeight: "800",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
  },

  emptyBox: {
    backgroundColor: "#020617",
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
  },
  emptyText: { color: "#94a3b8", fontSize: 13 },

  alertCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 20,
    padding: 16,
  },
  alertHeader: { flexDirection: "row", justifyContent: "space-between" },
  alertSeverity: { color: "#fff", fontWeight: "900", fontSize: 12 },
  alertTime: { color: "#fee2e2", fontSize: 11 },
  alertTitle: { color: "#fff", fontSize: 16, fontWeight: "900", marginTop: 6 },
  alertMsg: { color: "#fff", fontSize: 13, marginTop: 4, lineHeight: 18 },

  alertFooter: { flexDirection: "row", marginTop: 10 },
  badge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 8,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  badgeOutline: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeOutlineText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});