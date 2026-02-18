import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";

const { width } = Dimensions.get("window");

/* ===== ML SERVER ===== */
const ML_API = "http://10.38.236.151:5000/predict";   // your flask ML server

export default function DashboardScreen({ route }) {
  const username = route?.params?.username || "User";

  const [dailyData, setDailyData] = useState([]);
  const [gasLevelPercent, setGasLevelPercent] = useState(0);
  const [remainingDays, setRemainingDays] = useState(0);
  const [predictedUsage, setPredictedUsage] = useState(null);   // 🔥 ML state

  const animProgress = useRef(new Animated.Value(0)).current;

  /* =========================
     🔥 FIRESTORE LIVE DATA
  ========================= */
  useEffect(() => {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;

    const q = query(
      collection(db, "UsageHistory", uid, "daily"),
      orderBy("timestamp", "desc"),
      limit(7)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });

      setDailyData(data.reverse());
    });

    return () => unsub();
  }, []);

  /* =========================
     📊 ANALYTICS ENGINE
  ========================= */

  const weeklyUsage = useMemo(() => {
    return dailyData.map((d) => ({
      day: d.id.slice(8, 10),
      value: d.useKg || 0,
    }));
  }, [dailyData]);

  const totalUsed = useMemo(() => {
    return weeklyUsage.reduce((sum, d) => sum + d.value, 0);
  }, [weeklyUsage]);

  const avgPerDay = weeklyUsage.length ? totalUsed / weeklyUsage.length : 0;

  useEffect(() => {
    const CYLINDER_CAPACITY = 14.2;

    const used = totalUsed;
    const remaining = CYLINDER_CAPACITY - used;

    const percent = (remaining / CYLINDER_CAPACITY) * 100;
    const daysLeft = avgPerDay > 0 ? Math.floor(remaining / avgPerDay) : 0;

    const safePercent = Math.max(0, Math.floor(percent));

    setGasLevelPercent(safePercent);
    setRemainingDays(Math.max(0, daysLeft));

    Animated.timing(animProgress, {
      toValue: safePercent,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [totalUsed, avgPerDay]);

  const maxUsage = useMemo(() => {
    return weeklyUsage.length
      ? Math.max(...weeklyUsage.map((d) => d.value))
      : 1;
  }, [weeklyUsage]);

  const progressWidth = animProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  /* =========================
     🧠 ML PREDICTION ENGINE
  ========================= */

  useEffect(() => {
    if (!weeklyUsage.length) return;

    const runPrediction = async () => {
      try {
        const last = weeklyUsage[weeklyUsage.length - 1];

        const payload = {
          day_index: weeklyUsage.length,
          prev_usage: last.value || 0,
          cooking_sessions: 2,     // later replace with real sensor/app data
          weight_kg: 14.2 - totalUsed
        };

        const res = await fetch(ML_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        setPredictedUsage(data.predicted_daily_usage);   // 🔥 ML result

      } catch (err) {
        console.log("ML prediction error:", err.message);
      }
    };

    runPrediction();
  }, [weeklyUsage, totalUsed]);

  /* =========================
     🧠 UI
  ========================= */

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* HEADER */}
      <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.header}>
        <Text style={styles.greet}>Hi, {username}</Text>
        <Text style={styles.headerTitle}>Smart LPG System</Text>
        <Text style={styles.headerSub}>Live monitoring • AI prediction • Alerts</Text>
      </LinearGradient>

      {/* GAS LEVEL CARD */}
      <View style={styles.glassCard}>
        <Text style={styles.cardTitle}>Cylinder Status</Text>

        <View style={styles.progressCircleWrap}>
          <View style={styles.circleOuter}>
            <Text style={styles.circlePercent}>{gasLevelPercent}%</Text>
            <Text style={styles.circleLabel}>Remaining</Text>
          </View>
        </View>

        <View style={styles.progressBarWrap}>
          <View style={styles.progressBg}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
        </View>

        <Text style={styles.smallText}>Real-time cylinder estimation</Text>
      </View>

      {/* STATS GRID */}
      <View style={styles.grid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{remainingDays}</Text>
          <Text style={styles.statLabel}>Days Left</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{avgPerDay.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Kg / Day</Text>
        </View>
      </View>

      {/* WEEKLY GRAPH */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly Usage</Text>

        <View style={styles.chartWrap}>
          {weeklyUsage.map((item, index) => {
            const barHeight = (item.value / maxUsage) * 130;

            return (
              <View key={index} style={styles.chartItem}>
                <LinearGradient
                  colors={["#36d1dc", "#5b86e5"]}
                  style={[styles.bar, { height: barHeight }]}
                />
                <Text style={styles.dayText}>{item.day}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.smallText}>Live analytics from Firestore</Text>
      </View>

      {/* ALERT / AI TIP */}
      <LinearGradient colors={["#11998e", "#38ef7d"]} style={styles.tipCard}>
        <Text style={styles.tipTitle}>Smart AI Alert</Text>
        <Text style={styles.tipText}>
          {predictedUsage
            ? `Predicted tomorrow usage: ${predictedUsage.toFixed(2)} Kg`
            : "AI prediction loading..."}
        </Text>
      </LinearGradient>

      {/* ACTION BUTTONS */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionText}>View Alerts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnDark}>
          <Text style={styles.actionTextLight}>Usage Details</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

/* =========================
   🎨 STYLES
========================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0f14",
  },
  header: {
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  greet: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 4,
  },
  headerSub: {
    color: "#cfd8dc",
    marginTop: 4,
    fontSize: 13,
  },
  glassCard: {
    backgroundColor: "#111822",
    margin: 16,
    padding: 18,
    borderRadius: 22,
  },
  card: {
    backgroundColor: "#111822",
    marginHorizontal: 16,
    marginTop: 14,
    padding: 18,
    borderRadius: 22,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 14,
  },
  progressCircleWrap: {
    alignItems: "center",
    marginBottom: 14,
  },
  circleOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    borderColor: "#1abc9c",
    alignItems: "center",
    justifyContent: "center",
  },
  circlePercent: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
  },
  circleLabel: {
    color: "#aaa",
    fontSize: 12,
  },
  progressBarWrap: {
    marginTop: 10,
  },
  progressBg: {
    height: 10,
    backgroundColor: "#222",
    borderRadius: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: 10,
    backgroundColor: "#1abc9c",
  },
  smallText: {
    marginTop: 10,
    fontSize: 12,
    color: "#9aa0a6",
  },
  grid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 10,
  },
  statCard: {
    backgroundColor: "#111822",
    width: "48%",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
  },
  statValue: {
    color: "#38ef7d",
    fontSize: 28,
    fontWeight: "900",
  },
  statLabel: {
    color: "#aaa",
    fontSize: 12,
  },
  chartWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 150,
  },
  chartItem: {
    alignItems: "center",
    width: (width - 80) / 7,
  },
  bar: {
    width: 18,
    borderRadius: 10,
  },
  dayText: {
    color: "#aaa",
    fontSize: 11,
    marginTop: 6,
  },
  tipCard: {
    margin: 16,
    padding: 18,
    borderRadius: 22,
  },
  tipTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  tipText: {
    color: "#fff",
    fontSize: 13,
    marginTop: 6,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 10,
  },
  actionBtn: {
    backgroundColor: "#1abc9c",
    paddingVertical: 14,
    borderRadius: 16,
    width: "48%",
    alignItems: "center",
  },
  actionBtnDark: {
    backgroundColor: "#2c5364",
    paddingVertical: 14,
    borderRadius: 16,
    width: "48%",
    alignItems: "center",
  },
  actionText: {
    color: "#000",
    fontWeight: "800",
  },
  actionTextLight: {
    color: "#fff",
    fontWeight: "800",
  },
});
