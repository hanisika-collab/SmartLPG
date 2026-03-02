import React, { useEffect, useState, useMemo, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions, Animated, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

const { width } = Dimensions.get("window");
const ML_API = "http://10.38.236.151:5000/predict";

export default function DashboardScreen({ route, navigation }) {
  const username = route?.params?.username || "User";
  const [dailyData, setDailyData] = useState([]);
  const [gasLevelPercent, setGasLevelPercent] = useState(0);
  const [remainingDays, setRemainingDays] = useState(0);
  const [predictedUsage, setPredictedUsage] = useState(null);

  const animProgress = useRef(new Animated.Value(0)).current;

  // Fetch Live Data
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "UsageHistory", auth.currentUser.uid, "daily"), orderBy("timestamp", "desc"), limit(7));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDailyData(data.reverse());
    });
  }, []);

  const weeklyUsage = useMemo(() => dailyData.map(d => ({ day: d.id.slice(8, 10), value: d.useKg || 0 })), [dailyData]);
  const totalUsed = useMemo(() => weeklyUsage.reduce((sum, d) => sum + d.value, 0), [weeklyUsage]);

  // Main UI Update Logic
  useEffect(() => {
    const CYLINDER_CAPACITY = 14.2;
    const remaining = CYLINDER_CAPACITY - totalUsed;
    const percent = Math.max(0, Math.floor((remaining / CYLINDER_CAPACITY) * 100));
    
    setGasLevelPercent(percent);

    // Logic: If ML prediction exists, use it for Days Left. Otherwise, use average.
    const consumptionRate = predictedUsage || (weeklyUsage.length ? totalUsed / weeklyUsage.length : 0.25);
    const daysLeft = consumptionRate > 0 ? Math.floor(remaining / consumptionRate) : 0;
    setRemainingDays(Math.max(0, daysLeft));

    // Trigger low gas alert
    if (percent < 20 && percent > 0) {
      triggerLowGasAlert(percent);
    }

    Animated.timing(animProgress, { toValue: percent, duration: 900, useNativeDriver: false }).start();
  }, [totalUsed, predictedUsage]);

  const triggerLowGasAlert = async (p) => {
    await addDoc(collection(db, "alerts", auth.currentUser.uid, "logs"), {
      type: "LOW_GAS_WARNING",
      severity: "WARNING",
      message: `Cylinder is at ${p}%. Please book a refill soon.`,
      timestamp: serverTimestamp()
    });
  };

  // ML Prediction Call
  useEffect(() => {
    if (!weeklyUsage.length) return;
    const runPrediction = async () => {
      try {
        const res = await fetch(ML_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            day_index: weeklyUsage.length,
            prev_usage: weeklyUsage[weeklyUsage.length - 1].value || 0,
            cooking_sessions: 2,
            weight_kg: 14.2 - totalUsed
          }),
        });
        const data = await res.json();
        setPredictedUsage(data.predicted_daily_usage);

        // Log to System History
        await addDoc(collection(db, "systemHistory", auth.currentUser.uid, "logs"), {
          type: "PREDICTION",
          title: "AI Prediction Updated",
          message: `Model predicts ${data.predicted_daily_usage.toFixed(2)}kg usage tomorrow.`,
          status: "INFO",
          timestamp: serverTimestamp()
        });
      } catch (err) { console.log("ML Error:", err.message); }
    };
    runPrediction();
  }, [totalUsed]);

  const progressWidth = animProgress.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.header}>
        <Text style={styles.greet}>Hi, {username}</Text>
        <Text style={styles.headerTitle}>Smart LPG System</Text>
      </LinearGradient>

      <View style={styles.glassCard}>
        <Text style={styles.cardTitle}>Cylinder Status</Text>
        <View style={styles.progressCircleWrap}>
          <View style={styles.circleOuter}>
            <Text style={styles.circlePercent}>{gasLevelPercent}%</Text>
            <Text style={styles.circleLabel}>Remaining</Text>
          </View>
        </View>
        <View style={styles.progressBg}><Animated.View style={[styles.progressFill, { width: progressWidth }]} /></View>
      </View>

      <View style={styles.grid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{remainingDays}</Text>
          <Text style={styles.statLabel}>Days Left (AI)</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{(predictedUsage || 0).toFixed(2)}</Text>
          <Text style={styles.statLabel}>Pred. Kg/Day</Text>
        </View>
      </View>

      <LinearGradient colors={["#11998e", "#38ef7d"]} style={styles.tipCard}>
        <Text style={styles.tipTitle}>Smart AI Status</Text>
        <Text style={styles.tipText}>{predictedUsage ? `Predicted daily usage: ${predictedUsage.toFixed(2)} Kg` : "Analyzing patterns..."}</Text>
      </LinearGradient>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Alerts")}><Text style={styles.actionText}>View Alerts</Text></TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnDark} onPress={() => navigation.navigate("History")}><Text style={styles.actionTextLight}>History</Text></TouchableOpacity>
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