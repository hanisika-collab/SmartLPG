// Enhanced Professional UI version of DashboardScreen
import React, { useMemo, useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions, Alert, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { doc, onSnapshot, collection, query, orderBy, limit } from "firebase/firestore";
import { auth, db } from "../firebase";
import { startSimulation } from "../Simulator";
import { generatePrediction } from "../predictionEngine";
import { logSystemEvent } from "../logger/systemLogger";
const { width } = Dimensions.get("window");

export default function DashboardScreen({ route }) {
  const username = route?.params?.username || "User";

  const [gasData, setGasData] = useState(null);
  const [weeklyUsage, setWeeklyUsage] = useState([]);
  const [prediction, setPrediction] = useState(null);

  const anim = useRef(new Animated.Value(0)).current;
  const processedRef = useRef(new Set());
  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const unsub = onSnapshot(doc(db, "gasData", uid, "current", "status"), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGasData(data);

        const pred = await generatePrediction(uid, data.weight);
        setPrediction(pred);

      if (data.leak) {
      Alert.alert("⚠ Gas Leak Detected", "Immediate action required!");

      logSystemEvent({
      type: "SAFETY",
      title: "Gas Leak Detected",
      message: "Leak sensor triggered",
      status: "CRITICAL"
        });
      }


        Animated.timing(anim, {
          toValue: data.gasPercent,
          duration: 800,
          useNativeDriver: false,
        }).start();
      }
    });
    return () => unsub();
  }, []);
useEffect(() => {
  if (!auth.currentUser) return;

  const uid = auth.currentUser.uid;

  // 🔥 SYSTEM LOG
  logSystemEvent({
    type: "SYSTEM",
    title: "Dashboard Started",
    message: "User opened dashboard",
    status: "INFO"
  });

  startSimulation(uid);
}, []);

useEffect(() => {
  if (!auth.currentUser) return;

  const uid = auth.currentUser.uid;

  const q = query(
    collection(db, "usageHistory", uid, "records"),
    orderBy("timestamp", "desc"),
    limit(7)
  );

  const unsub = onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => {
      const usedKg = d.data().usedKg || 0;

      // ✅ Prevent duplicate logs
      if (!processedRef.current.has(d.id)) {
        processedRef.current.add(d.id);

        logSystemEvent({
          type: "USAGE",
          title: "Usage Recorded",
          message: `${usedKg} kg recorded`,
          status: "NORMAL"
        });
      }

      return { value: usedKg };
    }).reverse();

    setWeeklyUsage(data);
  });

  return () => unsub();
}, []);


  const maxUsage = useMemo(() => weeklyUsage.length ? Math.max(...weeklyUsage.map(d => d.value)) : 1, [weeklyUsage]);

  const animatedWidth = anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  if (!gasData) {
    return (
      <View style={styles.loader}>
        <Text style={{ color: "#fff" }}>Connecting to live sensor...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* HEADER */}
      <LinearGradient colors={["#020617", "#020617", "#0f172a"]} style={styles.header}>
        <Text style={styles.headerSmall}>Smart LPG System</Text>
        <Text style={styles.headerBig}>Dashboard</Text>
        <Text style={styles.headerUser}>Welcome, {username}</Text>
      </LinearGradient>

      {/* CYLINDER CARD */}
      <View style={styles.mainCard}>
        <Text style={styles.cardTitle}>Cylinder Status</Text>

        <View style={styles.circleWrap}>
          <View style={styles.circleOuter}>
            <Text style={styles.percent}>{gasData.gasPercent}%</Text>
            <Text style={styles.circleLabel}>Remaining</Text>
          </View>
        </View>

        <View style={styles.progressBg}>
          <Animated.View style={[styles.progressFill, { width: animatedWidth }]} />
        </View>

        <Text style={styles.subText}>Live Weight: {gasData.weight} kg</Text>
      </View>

      {/* PREDICTION GRID */}
      {prediction && (
        <View style={styles.predGrid}>
          <View style={styles.predBox}>
            <Text style={styles.predValue}>{prediction.avgPerDay}</Text>
            <Text style={styles.predLabel}>Kg / Day</Text>
          </View>
          <View style={styles.predBox}>
            <Text style={styles.predValue}>{prediction.daysLeft}</Text>
            <Text style={styles.predLabel}>Days Left</Text>
          </View>
          <View style={styles.predBoxWide}>
            <Text style={styles.predWideTitle}>Refill Date</Text>
            <Text style={styles.predWideValue}>{prediction.refillDate}</Text>
          </View>
        </View>
      )}

      {/* WEEKLY USAGE */}
      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>Weekly Consumption</Text>
        <View style={styles.chartWrap}>
          {weeklyUsage.map((item, i) => (
            <View key={i} style={styles.chartItem}>
              <LinearGradient
                colors={["#38bdf8", "#22c55e"]}
                style={[styles.bar, { height: (item.value / maxUsage) * 140 }]}
              />
              <Text style={styles.day}>D{i + 1}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ALERT CARD */}
      <LinearGradient colors={["#7f1d1d", "#991b1b"]} style={styles.alertCard}>
        <Text style={styles.alertTitle}>Smart Safety System</Text>
        <Text style={styles.alertText}>Auto alert if gas below 20% or leak detected</Text>
      </LinearGradient>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#020617" },

  header: { paddingTop: 50, paddingBottom: 30, paddingHorizontal: 20, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  headerSmall: { color: "#38bdf8", fontSize: 12, fontWeight: "700" },
  headerBig: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 4 },
  headerUser: { color: "#cbd5f5", marginTop: 6 },

  mainCard: { backgroundColor: "#020617", margin: 16, borderRadius: 22, padding: 20 },
  cardTitle: { color: "#38bdf8", fontSize: 15, fontWeight: "800", marginBottom: 12 },

  circleWrap: { alignItems: "center", marginBottom: 14 },
  circleOuter: { width: 130, height: 130, borderRadius: 65, borderWidth: 8, borderColor: "#22c55e", justifyContent: "center", alignItems: "center" },
  percent: { color: "#fff", fontSize: 34, fontWeight: "900" },
  circleLabel: { color: "#94a3b8", fontSize: 12 },

  progressBg: { height: 10, backgroundColor: "#1e293b", borderRadius: 10, overflow: "hidden", marginTop: 10 },
  progressFill: { height: 10, backgroundColor: "#22c55e" },
  subText: { color: "#94a3b8", marginTop: 10, textAlign: "center" },

  predGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: 16, gap: 12 },
  predBox: { backgroundColor: "#020617", width: "48%", borderRadius: 18, padding: 16, alignItems: "center" },
  predBoxWide: { backgroundColor: "#020617", width: "100%", borderRadius: 18, padding: 16, alignItems: "center" },
  predValue: { color: "#22c55e", fontSize: 26, fontWeight: "900" },
  predLabel: { color: "#94a3b8", fontSize: 12 },
  predWideTitle: { color: "#38bdf8", fontWeight: "800" },
  predWideValue: { color: "#fff", marginTop: 6, fontSize: 15, fontWeight: "700" },

  chartCard: { backgroundColor: "#020617", margin: 16, borderRadius: 22, padding: 18 },
  chartWrap: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 170 },
  chartItem: { alignItems: "center", width: (width - 80) / 7 },
  bar: { width: 16, borderRadius: 10 },
  day: { color: "#cbd5f5", fontSize: 11, marginTop: 6 },

  alertCard: { marginHorizontal: 16, borderRadius: 22, padding: 18 },
  alertTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  alertText: { color: "#fee2e2", marginTop: 6, fontSize: 13 },
});