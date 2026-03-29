import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot as onSnapshotFirestore,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, onValue } from "firebase/database";
import { db, auth, rtdb } from "../firebase";

const { width } = Dimensions.get("window");
// ⚠️ NOTE: Unga unmaiyana Laptop IP address
const ML_API = "http://10.156.155.151:5000/predict";

// ─── Constants ────────────────────────────────────────────────────────────────
const LOW_FUEL_THRESHOLD = 20; // percent
const CRITICAL_THRESHOLD = 10; // percent

// ─── Helpers ──────────────────────────────────────────────────────────────────
function localLinearRegression(logs, currentWeight) {
  if (!logs || logs.length < 2) return null;
  const n = logs.length;
  const t0 = logs[0].timestamp;
  const xs = logs.map((l) => (l.timestamp - t0) / 3600000); 
  const ys = logs.map((l) => l.weight);

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX); 
  if (slope >= 0) return null; 

  const dailyRate = Math.abs(slope) * 24; 
  if (dailyRate === 0) return null;

  const daysLeft = currentWeight / dailyRate;
  return { daysLeft: Math.round(daysLeft), dailyRate: dailyRate.toFixed(3) };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function GaugeRing({ percent, size = 160 }) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(spinAnim, {
      toValue: percent,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  const color =
    percent <= CRITICAL_THRESHOLD ? "#ef4444" : percent <= LOW_FUEL_THRESHOLD ? "#f59e0b" : "#10b981";

  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: size, height: size }}>
      <View style={{ position: "absolute", width: size - 20, height: size - 20, borderRadius: (size - 20) / 2, borderWidth: 10, borderColor: "#1e293b" }} />
      <View style={{ position: "absolute", width: size - 20, height: size - 20, borderRadius: (size - 20) / 2, borderWidth: 10, borderColor: color, opacity: 0.25 }} />
      <View style={{ alignItems: "center" }}>
        <Text style={{ color: color, fontSize: 36, fontWeight: "900", letterSpacing: -1 }}>
          {percent}%
        </Text>
        <Text style={{ color: "#64748b", fontSize: 11, fontWeight: "600", letterSpacing: 1.5 }}>
          FUEL LEVEL
        </Text>
      </View>
    </View>
  );
}

function StatBadge({ label, value, unit, color = "#10b981", icon }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatusBanner({ percent, daysLeft, cylinderRemoved }) {
  if (cylinderRemoved) {
    return (
      <LinearGradient colors={["#450a0a", "#7f1d1d"]} style={styles.banner}>
        <Text style={styles.bannerIcon}>🚫</Text>
        <View>
          <Text style={styles.bannerTitle}>CYLINDER REMOVED</Text>
          <Text style={styles.bannerSub}>Please place the cylinder back on the scale.</Text>
        </View>
      </LinearGradient>
    );
  }
  if (percent <= CRITICAL_THRESHOLD) {
    return (
      <LinearGradient colors={["#7f1d1d", "#991b1b"]} style={styles.banner}>
        <Text style={styles.bannerIcon}>🚨</Text>
        <View>
          <Text style={styles.bannerTitle}>CRITICAL — Refill Now!</Text>
          <Text style={styles.bannerSub}>Less than {CRITICAL_THRESHOLD}% remaining</Text>
        </View>
      </LinearGradient>
    );
  }
  if (percent <= LOW_FUEL_THRESHOLD) {
    return (
      <LinearGradient colors={["#78350f", "#92400e"]} style={styles.banner}>
        <Text style={styles.bannerIcon}>⚠️</Text>
        <View>
          <Text style={styles.bannerTitle}>Low Fuel — Plan a Refill</Text>
          <Text style={styles.bannerSub}>~{daysLeft} days remaining</Text>
        </View>
      </LinearGradient>
    );
  }
  return null;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function UsageScreen({ route, navigation }) {
  const username = route?.params?.username || "User";

  const [gasData, setGasData] = useState(null);
  const [usedKg, setUsedKg] = useState("0.000");
  const [maxCapacity, setMaxCapacity] = useState("0.000"); 
  const [usedPercent, setUsedPercent] = useState(100);
  const [remainingDays, setRemainingDays] = useState(null);
  const [dailyRate, setDailyRate] = useState(null);
  
  // ✨ Pudhu state: Cylinder irukka illaya nu check panna
  const [cylinderRemoved, setCylinderRemoved] = useState(false);

  const [weightLogs, setWeightLogs] = useState([]);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlPrediction, setMlPrediction] = useState(null);
  const [mlError, setMlError] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);

  const animProgress = useRef(new Animated.Value(100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const maxCapRef = useRef(0);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  // ── RTDB: Live sensor feed ──────────────────────────────────────────────────
  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const statusRef = ref(rtdb, `gasData/${uid}/current/status`);

    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return; 

      setGasData(data);

      // ✨ CYLINDER REMOVED LOGIC ✨
      if (data.isCylinderPresent === false) {
        setCylinderRemoved(true);
        // App-a freeze pandrom (Math update aagadhu)
        return; 
      }
      
      // Cylinder irundha normal-a work aagum
      setCylinderRemoved(false);

      const pct = data.gasPercent !== undefined ? Math.round(data.gasPercent) : 0;
      setUsedPercent(pct);

      if (pct > 0 && pct <= 100) {
        maxCapRef.current = (data.weight / pct) * 100; 
      } else if (maxCapRef.current === 0 && data.weight > 0) {
        maxCapRef.current = data.weight; // Fallback
      }

      setMaxCapacity(maxCapRef.current.toFixed(3));
      
      const consumed = Math.max(0, maxCapRef.current - data.weight);
      setUsedKg(consumed.toFixed(3));

      Animated.timing(animProgress, {
        toValue: pct,
        duration: 900,
        useNativeDriver: false,
      }).start();

      setWeightLogs((prev) => {
        const updated = [...prev, { weight: data.weight, timestamp: Date.now() }].slice(-100); 
        const result = localLinearRegression(updated, data.weight);
        if (result) {
          setRemainingDays(result.daysLeft);
          setDailyRate(result.dailyRate);
        }
        return updated;
      });

      if (Math.random() < 0.1) { 
        saveToFirestore(uid, data.weight, pct);
      }
    });

    return () => unsubscribe();
  }, []);

  const saveToFirestore = async (uid, weight, percent) => {
    try {
      await addDoc(collection(db, "users", uid, "usageLogs"), { weight, percent, timestamp: serverTimestamp() });
    } catch (e) {}
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const q = query(collection(db, "users", uid, "usageLogs"), orderBy("timestamp", "desc"), limit(30));
    const unsub = onSnapshotFirestore(q, (snap) => {
      const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setHistoryLogs(logs);
    });
    return () => unsub();
  }, []);

  // ── ML API: Fetch prediction ────────────────────────────────────────────────
  const fetchMLPrediction = useCallback(async () => {
    if (!gasData || cylinderRemoved) return;
    setMlLoading(true);
    setMlError(null);
    try {
      const payload = {
        current_weight: gasData.weight,
        initial_weight: maxCapRef.current,
        weight_logs: weightLogs.slice(-20),
      };
      const res = await fetch(ML_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json();
      setMlPrediction(json);
      if (json.days_left !== undefined) {
        setRemainingDays(json.days_left);
        setDailyRate(json.daily_rate_kg?.toFixed(3));
      }
    } catch (err) {
      setMlError("ML Server Offline. Using local data.");
    } finally {
      setMlLoading(false);
    }
  }, [gasData, weightLogs, cylinderRemoved]);

  const displayWeight = gasData?.weight?.toFixed(3) ?? "—";
  const displayDays = remainingDays !== null ? remainingDays : "—";
  const displayRate = dailyRate ?? "—";

  const progressColor =
    usedPercent <= CRITICAL_THRESHOLD ? "#ef4444" : usedPercent <= LOW_FUEL_THRESHOLD ? "#f59e0b" : "#10b981";

  return (
    <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#020617", "#0f172a", "#1e293b"]} style={styles.header}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.greet}>Welcome back,</Text>
              <Text style={styles.greetName}>{username} 👋</Text>
            </View>
            <TouchableOpacity style={styles.alertBell} onPress={() => navigation.navigate("Alerts")}>
              <Text style={{ fontSize: 22 }}>🔔</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>Smart LPG Monitor</Text>
          <Text style={styles.headerSub}>Real-time cylinder tracking & AI prediction</Text>
        </LinearGradient>

        {/* Status Banner */}
        <StatusBanner percent={usedPercent} daysLeft={displayDays} cylinderRemoved={cylinderRemoved} />

        <View style={styles.glassCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>⛽ Cylinder Status</Text>
            
            {/* ✨ DYNAMIC LIVE CHIP ✨ */}
            <View style={[styles.liveChip, { backgroundColor: cylinderRemoved ? "#7f1d1d" : (gasData ? "#064e3b" : "#1e293b") }]}>
              <View style={[styles.liveDot, { backgroundColor: cylinderRemoved ? "#fca5a5" : (gasData ? "#10b981" : "#475569") }]} />
              <Text style={[styles.liveText, { color: cylinderRemoved ? "#fca5a5" : (gasData ? "#10b981" : "#475569") }]}>
                {cylinderRemoved ? "REMOVED 🚫" : (gasData ? "LIVE" : "OFFLINE")}
              </Text>
            </View>

          </View>

          <View style={styles.gaugeWrapper}>
            <GaugeRing percent={usedPercent} size={170} />
          </View>

          <View style={styles.progressBg}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: animProgress.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }), backgroundColor: progressColor },
              ]}
            />
          </View>

          <View style={styles.weightRow}>
            <View style={styles.weightItem}>
              <Text style={styles.weightLabel}>Current</Text>
              <Text style={styles.weightValue}>{cylinderRemoved ? "0.000" : displayWeight} kg</Text>
            </View>
            <View style={styles.weightDivider} />
            <View style={styles.weightItem}>
              <Text style={styles.weightLabel}>Total Cap</Text>
              <Text style={styles.weightValue}>{maxCapacity || "—"} kg</Text>
            </View>
            <View style={styles.weightDivider} />
            <View style={styles.weightItem}>
              <Text style={styles.weightLabel}>Consumed</Text>
              <Text style={[styles.weightValue, { color: "#f59e0b" }]}>{usedKg} kg</Text>
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          <StatBadge icon="📅" label="Est. Days Left" value={displayDays} unit="days" color="#10b981" />
          <StatBadge icon="🔥" label="Daily Usage" value={displayRate} unit="kg/day" color="#f59e0b" />
        </View>

        <View style={styles.glassCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🤖 AI Prediction</Text>
            <TouchableOpacity onPress={fetchMLPrediction} style={styles.refreshBtn} disabled={mlLoading || cylinderRemoved}>
              {mlLoading ? <ActivityIndicator size="small" color="#10b981" /> : <Text style={styles.refreshText}>↻ Refresh</Text>}
            </TouchableOpacity>
          </View>
          {mlError ? <Text style={styles.mlError}>⚠️ {mlError}</Text> : null}
          <View style={styles.mlGrid}>
            <View style={styles.mlItem}>
              <Text style={styles.mlIcon}>📊</Text>
              <Text style={styles.mlValue}>{mlPrediction?.days_left ?? displayDays}</Text>
              <Text style={styles.mlLabel}>Days Predicted</Text>
            </View>
            <View style={styles.mlItem}>
              <Text style={styles.mlIcon}>📉</Text>
              <Text style={styles.mlValue}>{mlPrediction?.daily_rate_kg?.toFixed(3) ?? displayRate}</Text>
              <Text style={styles.mlLabel}>Avg kg/day</Text>
            </View>
            <View style={styles.mlItem}>
              <Text style={styles.mlIcon}>🎯</Text>
              <Text style={styles.mlValue}>{mlPrediction?.confidence ? `${(mlPrediction.confidence * 100).toFixed(0)}%` : "—"}</Text>
              <Text style={styles.mlLabel}>Confidence</Text>
            </View>
          </View>
        </View>

        {historyLogs.length > 0 && (
          <View style={styles.glassCard}>
            <Text style={styles.cardTitle}>📋 Recent Readings</Text>
            {historyLogs.slice(0, 5).map((log, i) => (
              <View key={log.id ?? i} style={styles.historyRow}>
                <Text style={styles.historyTime}>
                  {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                </Text>
                <View style={styles.historyBar}>
                  <View
                    style={[
                      styles.historyBarFill,
                      { width: `${log.percent ?? 0}%`, backgroundColor: (log.percent ?? 0) <= CRITICAL_THRESHOLD ? "#ef4444" : (log.percent ?? 0) <= LOW_FUEL_THRESHOLD ? "#f59e0b" : "#10b981" },
                    ]}
                  />
                </View>
                <Text style={styles.historyWeight}>{log.weight?.toFixed(3)} kg</Text>
              </View>
            ))}
          </View>
        )}

        <LinearGradient colors={["#0c1a33", "#0f2d4a"]} style={styles.tipCard}>
          <Text style={styles.tipTitle}>💡 Safety Tips</Text>
          {["Never store cylinders near heat sources", "Check regulator hose for cracks monthly", "If gas smell detected, open windows & call emergency"].map((tip, i) => (
            <Text key={i} style={styles.tipText}>{"  "}· {tip}</Text>
          ))}
        </LinearGradient>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Alerts")} activeOpacity={0.85}>
            <Text style={styles.actionIcon}>🛡️</Text>
            <Text style={styles.actionText}>Safety Hub</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtnDark} onPress={() => navigation.navigate("History")} activeOpacity={0.85}>
            <Text style={styles.actionIcon}>📈</Text>
            <Text style={styles.actionTextLight}>View Logs</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  header: { paddingTop: 52, paddingBottom: 28, paddingHorizontal: 22, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  greet: { color: "#64748b", fontSize: 13, fontWeight: "600", letterSpacing: 0.5 },
  greetName: { color: "#f1f5f9", fontSize: 20, fontWeight: "800", marginTop: 2 },
  headerTitle: { color: "#ffffff", fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  headerSub: { color: "#475569", fontSize: 13, marginTop: 4 },
  alertBell: { backgroundColor: "#1e293b", padding: 10, borderRadius: 14 },
  banner: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 14, padding: 14, borderRadius: 16, gap: 12 },
  bannerIcon: { fontSize: 26 },
  bannerTitle: { color: "#fff", fontWeight: "800", fontSize: 14 },
  bannerSub: { color: "#fca5a5", fontSize: 12, marginTop: 2 },
  glassCard: { backgroundColor: "#0f172a", margin: 16, marginBottom: 0, padding: 18, borderRadius: 24, borderWidth: 1, borderColor: "#1e293b" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  cardTitle: { color: "#f1f5f9", fontSize: 15, fontWeight: "800" },
  liveChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  gaugeWrapper: { alignItems: "center", marginVertical: 12 },
  progressBg: { height: 8, backgroundColor: "#1e293b", borderRadius: 8, overflow: "hidden", marginTop: 4 },
  progressFill: { height: 8, borderRadius: 8 },
  weightRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 16 },
  weightItem: { alignItems: "center" },
  weightLabel: { color: "#475569", fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  weightValue: { color: "#e2e8f0", fontSize: 16, fontWeight: "800", marginTop: 4 },
  weightDivider: { width: 1, backgroundColor: "#1e293b" },
  grid: { flexDirection: "row", justifyContent: "space-between", marginHorizontal: 16, marginTop: 14, gap: 12 },
  statCard: { backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b", flex: 1, borderRadius: 20, padding: 16, alignItems: "center" },
  statIcon: { fontSize: 24, marginBottom: 6 },
  statValue: { fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  statUnit: { color: "#475569", fontSize: 11, fontWeight: "600" },
  statLabel: { color: "#64748b", fontSize: 11, marginTop: 4, textAlign: "center" },
  refreshBtn: { backgroundColor: "#052e16", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  refreshText: { color: "#10b981", fontSize: 12, fontWeight: "700" },
  mlError: { color: "#fca5a5", fontSize: 12, marginBottom: 10, textAlign: "center" },
  mlGrid: { flexDirection: "row", justifyContent: "space-around", marginBottom: 14 },
  mlItem: { alignItems: "center" },
  mlIcon: { fontSize: 20, marginBottom: 4 },
  mlValue: { color: "#f1f5f9", fontSize: 22, fontWeight: "900" },
  mlLabel: { color: "#475569", fontSize: 10, marginTop: 2, textAlign: "center" },
  historyRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
  historyTime: { color: "#475569", fontSize: 11, width: 48 },
  historyBar: { flex: 1, height: 6, backgroundColor: "#1e293b", borderRadius: 6, overflow: "hidden" },
  historyBarFill: { height: 6, borderRadius: 6 },
  historyWeight: { color: "#94a3b8", fontSize: 11, width: 58, textAlign: "right" },
  tipCard: { margin: 16, marginTop: 14, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: "#172554" },
  tipTitle: { color: "#93c5fd", fontSize: 15, fontWeight: "800", marginBottom: 10 },
  tipText: { color: "#94a3b8", fontSize: 13, marginBottom: 6, lineHeight: 20 },
  actionRow: { flexDirection: "row", justifyContent: "space-between", marginHorizontal: 16, marginTop: 14, gap: 12 },
  actionBtn: { backgroundColor: "#10b981", paddingVertical: 16, borderRadius: 18, flex: 1, alignItems: "center" },
  actionBtnDark: { backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b", paddingVertical: 16, borderRadius: 18, flex: 1, alignItems: "center" },
  actionIcon: { fontSize: 18, marginBottom: 4 },
  actionText: { color: "#020617", fontWeight: "900", fontSize: 13 },
  actionTextLight: { color: "#94a3b8", fontWeight: "800", fontSize: 13 },
});