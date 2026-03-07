import React, { useEffect, useState, useMemo, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions, Animated, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { collection, query, orderBy, limit, onSnapshot as onSnapshotFirestore, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, onValue } from "firebase/database"; // RTDB logic
import { db, auth, rtdb } from "../firebase";

const { width } = Dimensions.get("window");
const ML_API = "http://10.38.236.151:5000/predict";

// ... (Imports stay the same)

export default function UsageScreen({ route, navigation }) {
  const username = route?.params?.username || "User";
  const [gasData, setGasData] = useState(null);
  const [initialWeight, setInitialWeight] = useState(null); // Dynamic Baseline
  const [usedToday, setUsedToday] = useState(0);
  const [remainingDays, setRemainingDays] = useState(10); // Initial 10-day approx
  const animProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const statusRef = ref(rtdb, `gasData/${uid}/current/status`);

    return onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.weight > 0.010) {
        setGasData(data);

        // Capture Dynamic Initial Weight
        if (initialWeight === null) {
          setInitialWeight(data.weight);
          return;
        }

        // Calculation Logic
        const consumption = initialWeight - data.weight;
        const usedFixed = consumption > 0 ? consumption.toFixed(3) : "0.000";
        setUsedToday(usedFixed);

        const percent = Math.max(0, Math.floor((data.weight / initialWeight) * 100));
        
        // Days Left Logic: Initial 10 days, then decreases based on usage
        const avgUsage = 0.100; // Assume 100g per day for prototype
        const daysLeft = Math.floor(data.weight / avgUsage);
        setRemainingDays(initialWeight ? daysLeft : 10);

        Animated.timing(animProgress, { toValue: percent, duration: 900, useNativeDriver: false }).start();
      }
    });
  }, [initialWeight]);

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.header}>
        <Text style={styles.greet}>Hi, {username}</Text>
        <Text style={styles.headerTitle}>Cylinder Monitoring</Text>
      </LinearGradient>

      <View style={styles.glassCard}>
        <Text style={styles.cardTitle}>Live Cylinder Status</Text>
        <View style={styles.progressCircleWrap}>
          <View style={styles.circleOuter}>
            <Text style={styles.circlePercent}>{initialWeight ? Math.floor((gasData?.weight / initialWeight) * 100) : 0}%</Text>
            <Text style={styles.circleLabel}>Fuel Level</Text>
          </View>
        </View>
        <View style={styles.progressBg}><Animated.View style={[styles.progressFill, { width: animProgress.interpolate({inputRange:[0,100], outputRange:["0%","100%"]}) }]} /></View>
        <Text style={{color: '#94a3b8', textAlign: 'center', marginTop: 10, fontSize: 12}}>
          Initial Capacity: {initialWeight?.toFixed(3)} kg
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{remainingDays}</Text>
          <Text style={styles.statLabel}>Est. Days Left</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={{...styles.statValue, color: '#fbbf24'}}>{usedToday}</Text>
          <Text style={styles.statLabel}>Used Today (kg)</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Alerts")}><Text style={styles.actionText}>Safety Hub</Text></TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnDark} onPress={() => navigation.navigate("History")}><Text style={styles.actionTextLight}>View Logs</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f14" },
  header: { paddingTop: 40, paddingBottom: 30, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  greet: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerTitle: { color: "#fff", fontSize: 26, fontWeight: "900" },
  glassCard: { backgroundColor: "#111822", margin: 16, padding: 18, borderRadius: 22 },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 14 },
  progressCircleWrap: { alignItems: "center", marginBottom: 14 },
  circleOuter: { width: 120, height: 120, borderRadius: 60, borderWidth: 8, borderColor: "#1abc9c", alignItems: "center", justifyContent: "center" },
  circlePercent: { color: "#fff", fontSize: 26, fontWeight: "900" },
  circleLabel: { color: "#aaa", fontSize: 12 },
  progressBg: { height: 10, backgroundColor: "#222", borderRadius: 10, overflow: "hidden" },
  progressFill: { height: 10, backgroundColor: "#1abc9c" },
  grid: { flexDirection: "row", justifyContent: "space-between", marginHorizontal: 16 },
  statCard: { backgroundColor: "#111822", width: "48%", borderRadius: 20, padding: 16, alignItems: "center" },
  statValue: { color: "#38ef7d", fontSize: 28, fontWeight: "900" },
  statLabel: { color: "#aaa", fontSize: 12 },
  tipCard: { margin: 16, padding: 18, borderRadius: 22 },
  tipTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  tipText: { color: "#fff", fontSize: 13, marginTop: 6 },
  actionRow: { flexDirection: "row", justifyContent: "space-between", marginHorizontal: 16, marginTop: 10 },
  actionBtn: { backgroundColor: "#1abc9c", paddingVertical: 14, borderRadius: 16, width: "48%", alignItems: "center" },
  actionBtnDark: { backgroundColor: "#2c5364", paddingVertical: 14, borderRadius: 16, width: "48%", alignItems: "center" },
  actionText: { color: "#000", fontWeight: "800" },
  actionTextLight: { color: "#fff", fontWeight: "800" },
});