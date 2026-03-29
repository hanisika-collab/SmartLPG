import React, { useMemo, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  Dimensions,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ref, onValue, set, get } from "firebase/database";
import { auth, rtdb } from "../firebase";

const { width } = Dimensions.get("window");

// ── Circular Arc Gauge ────────────────────────────────────────────────────────
function ArcGauge({ percent = 0, color }) {
  const anim = useRef(new Animated.Value(0)).current;
  const SIZE = 180;
  const STROKE = 14;
  const R = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * R;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: percent,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  const borderColor = color || "#22c55e";

  return (
    <View style={gaugeStyles.wrapper}>
      <View style={[gaugeStyles.ring, gaugeStyles.ringBg]} />
      <HalfRing percent={percent} color={borderColor} size={SIZE} stroke={STROKE} />
      <View style={gaugeStyles.center}>
        <Text style={[gaugeStyles.pct, { color: borderColor }]}>
          {Math.round(percent)}
          <Text style={gaugeStyles.pctSign}>%</Text>
        </Text>
        <Text style={gaugeStyles.label}>REMAINING</Text>
      </View>
    </View>
  );
}

function HalfRing({ percent, color, size, stroke }) {
  const half = size / 2;
  const deg = (percent / 100) * 360;
  const leftDeg = deg > 180 ? 180 : deg;
  const rightDeg = deg > 180 ? deg - 180 : 0;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={{ position: "absolute", width: half, height: size, left: half, overflow: "hidden" }}>
        <Animated.View
          style={{
            width: size, height: size, borderRadius: half, borderWidth: stroke,
            borderColor: color, borderLeftColor: "transparent",
            borderBottomColor: rightDeg > 90 ? color : "transparent",
            transform: [{ rotate: `${rightDeg - 45}deg` }],
            position: "absolute", left: -half,
          }}
        />
      </View>
      <View style={{ position: "absolute", width: half, height: size, left: 0, overflow: "hidden" }}>
        <View
          style={{
            width: size, height: size, borderRadius: half, borderWidth: stroke,
            borderColor: deg > 180 ? color : "transparent",
            borderRightColor: "transparent", borderTopColor: "transparent",
            transform: [{ rotate: `${leftDeg - 45}deg` }],
            position: "absolute", left: 0,
          }}
        />
      </View>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  wrapper: { width: 180, height: 180, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 152, height: 152, borderRadius: 76, borderWidth: 14 },
  ringBg: { borderColor: "#1e293b" },
  center: { alignItems: "center" },
  pct: { fontSize: 42, fontWeight: "900", letterSpacing: -1 },
  pctSign: { fontSize: 22, fontWeight: "600" },
  label: { color: "#475569", fontSize: 10, fontWeight: "700", letterSpacing: 2, marginTop: 2 },
});

// ── Stat Pill ─────────────────────────────────────────────────────────────────
function StatPill({ icon, label, value, accent }) {
  return (
    <View style={pillStyles.pill}>
      <Text style={pillStyles.icon}>{icon}</Text>
      <Text style={[pillStyles.value, { color: accent || "#fff" }]}>{value}</Text>
      <Text style={pillStyles.label}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: { flex: 1, backgroundColor: "#0f172a", borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#1e293b" },
  icon: { fontSize: 20, marginBottom: 6 },
  value: { fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
  label: { color: "#475569", fontSize: 11, fontWeight: "600", marginTop: 3, letterSpacing: 0.5 },
});

// ── Alert Badge ───────────────────────────────────────────────────────────────
function AlertBadge({ usedPercent, cylinderRemoved }) {
  if (cylinderRemoved) return null; // Cylinder eduthutta alert thevaiyilla
  if (usedPercent < 50) return null;
  const critical = usedPercent >= 90;
  return (
    <View style={[badgeStyles.badge, { backgroundColor: critical ? "rgba(239,68,68,0.12)" : "rgba(251,191,36,0.1)" }]}>
      <Text style={[badgeStyles.text, { color: critical ? "#ef4444" : "#fbbf24" }]}>
        {critical ? "⚠ CRITICAL — Refill Soon" : "⚡ 50% Consumed"}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { marginHorizontal: 15, borderRadius: 12, padding: 12, marginBottom: 4 },
  text: { fontWeight: "700", fontSize: 13, textAlign: "center" },
});

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return <View style={{ height: 1, backgroundColor: "#1e293b", marginVertical: 16 }} />;
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function DashboardScreen({ route }) {
  const [gasData, setGasData] = useState(null);
  const [initialWeight, setInitialWeight] = useState(null);
  const [usedToday, setUsedToday] = useState("0.000");
  const [alertsSent, setAlertsSent] = useState({ half: false, critical: false });
  const [remainingPercent, setRemainingPercent] = useState(100);
  
  // ✨ PUDHU STATE: Cylinder irukka illaya nu track panna
  const [cylinderRemoved, setCylinderRemoved] = useState(false);

  const gaugeColor = cylinderRemoved ? "#64748b" : remainingPercent <= 10 ? "#ef4444" : remainingPercent <= 50 ? "#fbbf24" : "#22c55e";

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const statusRef = ref(rtdb, `gasData/${uid}/current/status`);
    const baselineRef = ref(rtdb, `gasData/${uid}/baseline/weight`);

    let currentBaseline = null;

    const fetchBaseline = async () => {
      const snapshot = await get(baselineRef);
      if (snapshot.exists()) {
        currentBaseline = snapshot.val();
        setInitialWeight(currentBaseline);
      }
    };
    fetchBaseline();

    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data && typeof data.weight === 'number') {
        setGasData(data);

        // ✨ FIX: Cylinder Removed Logic
        if (data.isCylinderPresent === false) {
          setCylinderRemoved(true);
          return; // Freeze App! (Percentage maaradhu)
        }
        
        setCylinderRemoved(false); // Cylinder irundha normal aagidum

        if (currentBaseline === null || currentBaseline === 0) {
          currentBaseline = data.weight;
          set(baselineRef, currentBaseline);
          setInitialWeight(currentBaseline);
        }

        const currentWeight = data.weight;
        const consumption = Math.max(0, currentBaseline - currentWeight);
        setUsedToday(consumption.toFixed(3));

        let pct = currentBaseline > 0 ? (currentWeight / currentBaseline) * 100 : 0;
        if (pct < 0) pct = 0;
        if (pct > 100) pct = 100;
        
        setRemainingPercent(pct);

        const usedPct = 100 - pct;
        if (usedPct >= 50 && usedPct < 90 && !alertsSent.half) {
          Alert.alert("Cylinder Update", "Half of your gas (50%) has been consumed.");
          setAlertsSent((p) => ({ ...p, half: true }));
        } else if (usedPct >= 90 && !alertsSent.critical) {
          Alert.alert("⚠ CRITICAL", "90% of your gas is finished! Refill soon.");
          setAlertsSent((p) => ({ ...p, critical: true }));
        }
      }
    });

    return () => unsubscribe();
  }, [alertsSent]);

  const handleResetCylinder = () => {
    if (!gasData || typeof gasData.weight !== 'number') {
      Alert.alert("Waiting for Data", "Please wait for the sensor to send data.");
      return;
    }
    if (cylinderRemoved) {
      Alert.alert("Cylinder Missing", "Please place the new cylinder on the scale first!");
      return;
    }

    Alert.alert(
      "Reset Cylinder",
      "Are you sure you connected a new cylinder? This will reset the baseline weight.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Reset",
          onPress: () => {
            if (!auth.currentUser) return;
            const baselineRef = ref(rtdb, `gasData/${auth.currentUser.uid}/baseline/weight`);
            set(baselineRef, gasData.weight);
            setInitialWeight(gasData.weight);
            setUsedToday("0.000");
            setRemainingPercent(100);
            setAlertsSent({ half: false, critical: false });
            Alert.alert("Success", `New cylinder baseline set to ${gasData.weight} kg`);
          },
        },
      ]
    );
  };

  const usedPercent = 100 - remainingPercent;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ── HEADER ── */}
        <LinearGradient colors={["#020617", "#0c1628"]} style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerEyebrow}>⚡ LIVE MONITORING</Text>
              <Text style={styles.headerTitle}>LPG Monitor</Text>
            </View>
            <TouchableOpacity style={styles.resetBtn} onPress={handleResetCylinder} disabled={cylinderRemoved}>
              <Text style={styles.resetIcon}>🔄</Text>
              <Text style={styles.resetLabel}>New Cylinder</Text>
            </TouchableOpacity>
          </View>

          {/* ✨ DYNAMIC STATUS CHIP ✨ */}
          <View style={[styles.statusChip, { backgroundColor: cylinderRemoved ? "#7f1d1d" : (gasData ? "#0f172a" : "#0f172a") }]}>
            <View style={[styles.dot, { backgroundColor: cylinderRemoved ? "#fca5a5" : (gasData ? "#22c55e" : "#475569") }]} />
            <Text style={[styles.statusText, { color: cylinderRemoved ? "#fca5a5" : "#94a3b8" }]}>
              {cylinderRemoved ? "Cylinder Removed! 🚫" : (gasData ? "Sensor Connected" : "Waiting for data…")}
            </Text>
          </View>
        </LinearGradient>

        {/* ── ALERT BADGE ── */}
        <AlertBadge usedPercent={usedPercent} cylinderRemoved={cylinderRemoved} />

        {/* ── GAUGE CARD ── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>CYLINDER LEVEL</Text>
          <View style={styles.gaugeRow}>
            <ArcGauge percent={remainingPercent} color={gaugeColor} />
            <View style={styles.legend}>
              <LegendItem dot="#22c55e" label="Safe Zone" range="50–100%" />
              <LegendItem dot="#fbbf24" label="Low" range="10–50%" />
              <LegendItem dot="#ef4444" label="Critical" range="0–10%" />
            </View>
          </View>

          <Divider />

          {/* Pill stats */}
          <View style={styles.pillRow}>
            <StatPill icon="📦" label="Baseline" value={`${initialWeight?.toFixed(2) ?? "—"} kg`} accent="#38bdf8" />
            <View style={{ width: 10 }} />
            <StatPill icon="🔥" label="Consumed" value={`${usedToday} kg`} accent="#fbbf24" />
            <View style={{ width: 10 }} />
            <StatPill icon="⚖️" label="Available" value={cylinderRemoved ? "0.00 kg" : `${gasData?.weight?.toFixed(2) ?? "—"} kg`} accent={gaugeColor} />
          </View>
        </View>

        {/* ── PROGRESS BAR CARD ── */}
        <View style={styles.card}>
          <View style={styles.progressHeader}>
            <Text style={styles.cardLabel}>CONSUMPTION</Text>
            <Text style={[styles.progressPct, { color: gaugeColor }]}>{usedPercent.toFixed(1)}% used</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressSegment, { left: "0%", backgroundColor: "#22c55e22" }]} />
            <View style={[styles.progressSegment, { left: "50%", backgroundColor: "#fbbf2418" }]} />
            <View style={[styles.progressSegment, { left: "90%", backgroundColor: "#ef444420", right: 0, width: undefined }]} />
            <Animated.View style={[styles.progressFill, { width: `${Math.min(usedPercent, 100)}%`, backgroundColor: gaugeColor }]} />
          </View>

          <View style={styles.progressTicks}>
            <Text style={styles.tick}>0%</Text>
            <Text style={styles.tick}>50%</Text>
            <Text style={styles.tick}>90%</Text>
            <Text style={styles.tick}>100%</Text>
          </View>
        </View>

        {/* ── ML CARD ── */}
        <View style={[styles.card, styles.mlCard]}>
          <View style={styles.mlRow}>
            <Text style={styles.mlIcon}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.mlTitle}>ML Training Data</Text>
              <Text style={styles.mlBody}>
                Recording pattern — {usedToday} kg extracted from {initialWeight?.toFixed(3) ?? "0.000"} kg baseline capacity.
              </Text>
            </View>
          </View>
          <View style={styles.mlBadge}>
            <Text style={styles.mlBadgeText}>{cylinderRemoved ? "⏸️ PAUSED" : "● RECORDING"}</Text>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

function LegendItem({ dot, label, range }) {
  return (
    <View style={legStyles.row}>
      <View style={[legStyles.dot, { backgroundColor: dot }]} />
      <View>
        <Text style={legStyles.label}>{label}</Text>
        <Text style={legStyles.range}>{range}</Text>
      </View>
    </View>
  );
}

const legStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  label: { color: "#cbd5e1", fontSize: 12, fontWeight: "700" },
  range: { color: "#475569", fontSize: 11 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  header: { paddingTop: 58, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginBottom: 14 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerEyebrow: { color: "#38bdf8", fontSize: 11, fontWeight: "800", letterSpacing: 2, marginBottom: 4 },
  headerTitle: { color: "#f1f5f9", fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  statusChip: { flexDirection: "row", alignItems: "center", marginTop: 14, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#1e293b" },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  statusText: { fontSize: 12, fontWeight: "600" },
  resetBtn: { alignItems: "center", backgroundColor: "rgba(56,189,248,0.08)", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: "rgba(56,189,248,0.2)" },
  resetIcon: { fontSize: 18 },
  resetLabel: { color: "#38bdf8", fontSize: 10, fontWeight: "700", marginTop: 3, letterSpacing: 0.5 },
  card: { backgroundColor: "#0a1628", marginHorizontal: 15, marginBottom: 12, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: "#1e293b" },
  cardLabel: { color: "#334155", fontSize: 11, fontWeight: "800", letterSpacing: 2, marginBottom: 18 },
  gaugeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  legend: { flex: 1, paddingLeft: 20 },
  pillRow: { flexDirection: "row" },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  progressPct: { fontSize: 13, fontWeight: "700" },
  progressTrack: { height: 10, backgroundColor: "#1e293b", borderRadius: 8, overflow: "hidden", position: "relative" },
  progressSegment: { position: "absolute", top: 0, bottom: 0, width: "50%" },
  progressFill: { position: "absolute", top: 0, left: 0, bottom: 0, borderRadius: 8, opacity: 0.9 },
  progressTicks: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  tick: { color: "#334155", fontSize: 10 },
  mlCard: { borderColor: "#1e3a5f", backgroundColor: "#060f1e" },
  mlRow: { flexDirection: "row", alignItems: "flex-start" },
  mlIcon: { fontSize: 28, marginRight: 14 },
  mlTitle: { color: "#38bdf8", fontWeight: "800", fontSize: 14, marginBottom: 5 },
  mlBody: { color: "#64748b", fontSize: 12, lineHeight: 18 },
  mlBadge: { marginTop: 14, backgroundColor: "rgba(34,197,94,0.08)", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "rgba(34,197,94,0.2)" },
  mlBadgeText: { color: "#22c55e", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
});