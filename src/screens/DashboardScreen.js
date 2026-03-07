import React, { useMemo, useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ref, onValue } from "firebase/database"; 
import { auth, rtdb } from "../firebase"; 

const { width } = Dimensions.get("window");
const API_BASE = "http://10.38.236.151:5000"; 

// ... (Imports and API_BASE remains same)

export default function DashboardScreen({ route }) {
  const [gasData, setGasData] = useState(null);
  const [initialWeight, setInitialWeight] = useState(null);
  const [usedToday, setUsedToday] = useState(0);
  const [alertsSent, setAlertsSent] = useState({ half: false, critical: false });
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!auth.currentUser) return;
    const statusRef = ref(rtdb, `gasData/${auth.currentUser.uid}/current/status`);

    return onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.weight > 0.010) {
        setGasData(data);

        // 1. DYNAMIC BASELINE (Initial Weight)
        // System start aagumbothu irukkura weight-ah 'Full' reference-ah edukkom
        if (initialWeight === null) {
          setInitialWeight(data.weight);
          return;
        }

        // 2. MATHEMATICAL CALCULATIONS
        const currentWeight = data.weight;
        const totalCapacity = initialWeight;
        
        // Usage = Initial - Current (Fixed difference)
        const consumption = totalCapacity - currentWeight;
        const usageFixed = consumption > 0 ? consumption.toFixed(3) : "0.000";
        setUsedToday(usageFixed);

        // Percentage Remaining
        const remainingPercent = (currentWeight / totalCapacity) * 100;
        const usedPercent = 100 - remainingPercent;

        // 3. MILESTONE ALERTS (50% and 90%)
        if (usedPercent >= 50 && usedPercent < 90 && !alertsSent.half) {
          Alert.alert("Cylinder Update", "Half of your gas (50%) has been consumed.");
          setAlertsSent(prev => ({ ...prev, half: true }));
        } 
        else if (usedPercent >= 90 && !alertsSent.critical) {
          Alert.alert("⚠ CRITICAL", "90% of your gas is finished! Refill soon.");
          setAlertsSent(prev => ({ ...prev, critical: true }));
        }

        // Update Gauge
        Animated.timing(anim, {
          toValue: remainingPercent,
          duration: 800,
          useNativeDriver: false,
        }).start();
      }
    });
  }, [initialWeight, alertsSent]);

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={["#020617", "#0f172a"]} style={styles.header}>
        <Text style={styles.headerBig}>LPG Smart Monitor</Text>
      </LinearGradient>

      {/* USAGE CARD */}
      <View style={styles.mainCard}>
        <Text style={styles.cardTitle}>Current Session Usage</Text>
        <View style={styles.statsRow}>
           <View style={styles.statItem}>
              <Text style={{...styles.statVal, color: '#fbbf24'}}>{usedToday} kg</Text>
              <Text style={styles.statLabel}>Total Consumed</Text>
           </View>
           <View style={styles.statDivider} />
           <View style={styles.statItem}>
              <Text style={styles.statVal}>{gasData?.weight.toFixed(3) || "0.000"} kg</Text>
              <Text style={styles.statLabel}>Available Weight</Text>
           </View>
        </View>

        <View style={styles.progressBg}>
          <Animated.View style={[
            styles.progressFill, 
            { 
              width: anim.interpolate({inputRange: [0, 100], outputRange: ["0%", "100%"]}),
              backgroundColor: usedToday > (initialWeight * 0.9) ? '#ef4444' : '#22c55e'
            }
          ]} />
        </View>
        <Text style={styles.subText}>Baseline Weight: {initialWeight?.toFixed(3)} kg</Text>
      </View>

      {/* ML DATA SET STATUS */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>🤖 ML Training Data</Text>
        <Text style={styles.infoText}>
          Recording consumption pattern: {usedToday}kg extracted from {initialWeight}kg capacity.
        </Text>
      </View>
    </ScrollView>
  );
}
// ... (Styles stay the same as before)

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { padding: 30, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerSmall: { color: "#38bdf8", fontSize: 14, fontWeight: "bold" },
  headerBig: { color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 5 },
  mainCard: { backgroundColor: "#020617", margin: 15, borderRadius: 20, padding: 20, elevation: 10 },
  cardTitle: { color: "#38bdf8", fontSize: 16, fontWeight: "bold", marginBottom: 20 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statItem: { alignItems: "center", flex: 1 },
  statVal: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  statLabel: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: "#1e293b" },
  progressBg: { height: 12, backgroundColor: "#1e293b", borderRadius: 10, overflow: "hidden", marginTop: 25 },
  progressFill: { height: 12, backgroundColor: "#22c55e" },
  subText: { color: "#64748b", marginTop: 15, textAlign: "center", fontSize: 12 },
  infoCard: { backgroundColor: "#1e293b", margin: 15, padding: 20, borderRadius: 20 },
  infoTitle: { color: "#38bdf8", fontWeight: "bold", marginBottom: 8 },
  infoText: { color: "#cbd5e1", fontSize: 13, lineHeight: 20 },
  alertCard: { margin: 15, padding: 20, borderRadius: 20 },
  alertTitle: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  alertText: { color: "#fecaca", fontSize: 13, marginTop: 5 }
});