import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { collection, onSnapshot as onSnapshotFirestore, query, orderBy } from "firebase/firestore";
import { ref, onValue } from "firebase/database"; // RTDB logic
import { db, auth, rtdb } from "../firebase";

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    
    // 1. Listen to Firestore History (Usage & Safety Alerts)
    const q = query(collection(db, "alerts", uid, "logs"), orderBy("timestamp", "desc"));
    
    const unsubFirestore = onSnapshotFirestore(q, (snap) => {
      const fetchedAlerts = snap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        // Format timestamp for display
        displayTime: doc.data().timestamp?.toDate 
          ? doc.data().timestamp.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) 
          : new Date().toLocaleTimeString()
      }));
      setAlerts(fetchedAlerts);
    });

    return () => unsubFirestore();
  }, []);

  const getColor = (severity) => {
    if (severity === "CRITICAL") return ["#7f1d1d", "#dc2626"]; // Red
    if (severity === "WARNING") return ["#78350f", "#f59e0b"];  // Orange
    return ["#1e3a8a", "#2563eb"]; // Blue
  };

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={["#020617", "#0f172a"]} style={styles.header}>
        <Text style={styles.headerBig}>Safety & Usage Hub</Text>
      </LinearGradient>

      {alerts.length === 0 ? (
        <View style={styles.emptyBox}><Text style={styles.emptyText}>No alerts at the moment.</Text></View>
      ) : (
        alerts.map((alert) => (
          <LinearGradient key={alert.id} colors={getColor(alert.severity)} style={styles.alertCard}>
            <View style={styles.alertHeaderRow}>
               <Text style={styles.alertSeverity}>{alert.severity}</Text>
               <Text style={styles.alertTime}>{alert.displayTime}</Text>
            </View>
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
  header: { paddingTop: 50, paddingBottom: 30, paddingHorizontal: 20, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  headerBig: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 4 },
  emptyBox: { backgroundColor: "#020617", marginHorizontal: 16, borderRadius: 18, padding: 20, alignItems: "center" },
  emptyText: { color: "#94a3b8", fontSize: 13 },
  alertCard: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 16 },
  alertSeverity: { color: "#fff", fontWeight: "900", fontSize: 12 },
  alertTitle: { color: "#fff", fontSize: 16, fontWeight: "900", marginTop: 6 },
  alertMsg: { color: "#fff", fontSize: 13, marginTop: 4, lineHeight: 18 },
  alertHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  alertTime: { color: '#fff', fontSize: 11, opacity: 0.8 },
  alertSeverity: { color: "#fff", fontWeight: "900", fontSize: 12 },
});