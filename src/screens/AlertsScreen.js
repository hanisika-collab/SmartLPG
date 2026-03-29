import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  StatusBar,
  Vibration,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  onSnapshot as onSnapshotFirestore,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, onValue } from "firebase/database";
import { db, auth, rtdb } from "../firebase";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const SEVERITY_CONFIG = {
  CRITICAL: {
    icon: "🚨",
    label: "CRITICAL",
    bg: ["#1a0505", "#2d0a0a"],
    border: "#dc2626",
    badge: "#dc2626",
    text: "#fca5a5",
  },
  WARNING: {
    icon: "⚠️",
    label: "WARNING",
    bg: ["#1a0f00", "#2d1a00"],
    border: "#f59e0b",
    badge: "#f59e0b",
    text: "#fcd34d",
  },
  INFO: {
    icon: "ℹ️",
    label: "INFO",
    bg: ["#00111a", "#001f2d"],
    border: "#38bdf8",
    badge: "#38bdf8",
    text: "#7dd3fc",
  },
};

const TABS = ["ALL", "CRITICAL", "WARNING", "INFO"];

// ─────────────────────────────────────────────
// LIVE GAS LEAK BANNER
// ─────────────────────────────────────────────
function LeakBanner({ leakDetected }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (leakDetected) {
      Vibration.vibrate([0, 400, 200, 400]);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.03, duration: 500, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [leakDetected]);

  if (!leakDetected) return null;

  return (
    <Animated.View style={[bannerStyles.wrap, { transform: [{ scale: pulse }] }]}>
      <LinearGradient colors={["#450a0a", "#7f1d1d"]} style={bannerStyles.gradient}>
        <Text style={bannerStyles.icon}>🚨</Text>
        <View style={{ flex: 1 }}>
          <Text style={bannerStyles.title}>GAS LEAK DETECTED</Text>
          <Text style={bannerStyles.sub}>
            Open windows immediately · Turn off cylinder · Do not use switches
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const bannerStyles = StyleSheet.create({
  wrap: { marginHorizontal: 15, marginBottom: 12, borderRadius: 18, overflow: "hidden" },
  gradient: { flexDirection: "row", alignItems: "center", padding: 16, borderWidth: 1, borderColor: "#dc2626", borderRadius: 18, gap: 14 },
  icon: { fontSize: 30 },
  title: { color: "#fca5a5", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  sub: { color: "#fca5a580", fontSize: 11, lineHeight: 16, marginTop: 3 },
});

// ─────────────────────────────────────────────
// ALERT CARD
// ─────────────────────────────────────────────
function AlertCard({ alert, index }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.INFO;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      delay: index * 60,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, marginHorizontal: 15, marginBottom: 10 }}>
      <View style={[cardStyles.card, { borderLeftColor: cfg.border, borderColor: cfg.border + "40" }]}>
        <View style={cardStyles.topRow}>
          <View style={[cardStyles.severityBadge, { backgroundColor: cfg.badge + "1a", borderColor: cfg.badge + "40" }]}>
            <Text style={cardStyles.severityIcon}>{cfg.icon}</Text>
            <Text style={[cardStyles.severityText, { color: cfg.badge }]}>{cfg.label}</Text>
          </View>
          <Text style={cardStyles.time}>{alert.displayTime}</Text>
        </View>
        <Text style={cardStyles.type}>{alert.type?.replace(/_/g, " ") ?? "ALERT"}</Text>
        <Text style={[cardStyles.message, { color: cfg.text }]}>{alert.message}</Text>
        {alert.weight != null && (
          <View style={cardStyles.metaRow}>
            <MetaChip label="Weight" value={`${alert.weight?.toFixed(3)} kg`} />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function MetaChip({ label, value }) {
  return (
    <View style={cardStyles.chip}>
      <Text style={cardStyles.chipLabel}>{label}</Text>
      <Text style={cardStyles.chipValue}>{value}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { backgroundColor: "#060e1c", borderRadius: 16, padding: 14, borderWidth: 1, borderLeftWidth: 3 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  severityBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, gap: 5 },
  severityIcon: { fontSize: 11 },
  severityText: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  time: { color: "#475569", fontSize: 11, fontWeight: "800" },
  type: { color: "#e2e8f0", fontSize: 15, fontWeight: "800", marginBottom: 4, letterSpacing: -0.3 },
  message: { fontSize: 12, lineHeight: 18 },
  metaRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  chip: { backgroundColor: "#0f172a", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#1e293b" },
  chipLabel: { color: "#475569", fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  chipValue: { color: "#94a3b8", fontSize: 11, fontWeight: "700", marginTop: 1 },
});

// ─────────────────────────────────────────────
// FILTER TABS & EMPTY STATE
// ─────────────────────────────────────────────
function FilterTabs({ active, onChange, counts }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={tabStyles.row}>
      {TABS.map((tab) => {
        const isActive = active === tab;
        const cfg = SEVERITY_CONFIG[tab];
        const accent = cfg?.badge ?? "#38bdf8";
        const count = counts[tab] ?? 0;
        return (
          <TouchableOpacity key={tab} onPress={() => onChange(tab)} style={[tabStyles.tab, isActive && { borderColor: accent, backgroundColor: accent + "14" }]}>
            <Text style={[tabStyles.label, isActive && { color: accent }]}>{cfg?.icon ?? "🔍"} {tab}</Text>
            {count > 0 && <View style={[tabStyles.count, { backgroundColor: isActive ? accent : "#1e293b" }]}><Text style={[tabStyles.countText, isActive && { color: "#000" }]}>{count}</Text></View>}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const tabStyles = StyleSheet.create({
  row: { paddingHorizontal: 15, gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#1e293b", backgroundColor: "#0a1628", gap: 6 },
  label: { color: "#475569", fontSize: 12, fontWeight: "700" },
  count: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  countText: { color: "#94a3b8", fontSize: 10, fontWeight: "800" },
});

function EmptyState({ tab }) {
  return (
    <View style={emptyStyles.box}>
      <Text style={emptyStyles.emoji}>{tab === "CRITICAL" ? "✅" : tab === "WARNING" ? "👍" : "🔔"}</Text>
      <Text style={emptyStyles.title}>All Clear</Text>
      <Text style={emptyStyles.sub}>{tab === "ALL" ? "No alerts logged yet. Your cylinder is being monitored." : `No ${tab.toLowerCase()} alerts found.`}</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  box: { alignItems: "center", paddingVertical: 50, paddingHorizontal: 30 },
  emoji: { fontSize: 48, marginBottom: 14 },
  title: { color: "#e2e8f0", fontSize: 18, fontWeight: "800", marginBottom: 6 },
  sub: { color: "#475569", fontSize: 13, textAlign: "center", lineHeight: 20 },
});

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function AlertsScreen() {
  const [firestoreAlerts, setFirestoreAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState("ALL");
  const [leakDetected, setLeakDetected] = useState(false);

  // Database spam thadukka oru cooldown tracker (Store pandrathukkaga)
  const lastSavedAlertRef = useRef({ leak: 0, critical: 0, warning: 0 });

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    // ── 1. Firestore: History Data Edukkurom ──
    const q = query(collection(db, "alerts", uid, "logs"), orderBy("timestamp", "desc"));
    const unsubFirestore = onSnapshotFirestore(q, (snap) => {
      const fetched = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        displayTime: doc.data().timestamp?.toDate
          ? doc.data().timestamp.toDate().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
          : "Just now",
      }));
      setFirestoreAlerts(fetched);
    });

    // ── Helper: Save Alert to Database ──
    const saveAlertToDB = async (type, message, severity, weight, categoryKey) => {
      const now = Date.now();
      // Oru alert already save aagi 1 hour aagalana thirumba save panna koodadhu (Database spam fix)
      if (now - lastSavedAlertRef.current[categoryKey] < 3600000) return;

      try {
        await addDoc(collection(db, "alerts", uid, "logs"), {
          type,
          message,
          severity,
          weight: weight || 0,
          timestamp: serverTimestamp(),
        });
        lastSavedAlertRef.current[categoryKey] = now; // Timer update
      } catch (error) {
        console.log("Error saving alert to history:", error);
      }
    };

    // ── 2. RTDB: Live Data Watcher ──
    const statusRef = ref(rtdb, `gasData/${uid}/current/status`);
    const unsubStatus = onValue(statusRef, (snap) => {
      const data = snap.val();
      if (data) {
        // Gas Leak Check
        const GAS_THRESHOLD = 1800; 
        const isLeaking = data.gas_leakage > GAS_THRESHOLD || data.leakDetected === true;
        setLeakDetected(isLeaking);

        if (isLeaking) {
          saveAlertToDB("GAS LEAK DETECTED", "Open windows immediately. Turn off your cylinder.", "CRITICAL", data.weight, "leak");
        }

        // Low Gas Level Checks
        const pct = data.gasPercent;
        if (pct !== undefined) {
          if (pct <= 10) {
            saveAlertToDB("CYLINDER EMPTY SOON", `Your gas is at a critical level (${pct.toFixed(1)}%). Udane refill paniko!`, "CRITICAL", data.weight, "critical");
          } else if (pct <= 50) {
            saveAlertToDB("HALF CAPACITY REACHED", `Your gas is exactly half empty (${pct.toFixed(1)}%). Plan for a refill soon.`, "WARNING", data.weight, "warning");
          }
        }
      }
    });

    return () => {
      unsubFirestore();
      unsubStatus();
    };
  }, []);

  // Count per severity for badge numbers
  const counts = {
    ALL: firestoreAlerts.length,
    CRITICAL: firestoreAlerts.filter((a) => a.severity === "CRITICAL").length,
    WARNING: firestoreAlerts.filter((a) => a.severity === "WARNING").length,
    INFO: firestoreAlerts.filter((a) => a.severity === "INFO").length,
  };

  const filtered = activeTab === "ALL" ? firestoreAlerts : firestoreAlerts.filter((a) => a.severity === activeTab);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#020617", "#0c1628"]} style={styles.header}>
          <Text style={styles.eyebrow}>⚡ SMART LPG SYSTEM</Text>
          <Text style={styles.title}>Safety &amp; Alerts Hub</Text>
          <View style={styles.headerMeta}>
            <View style={styles.liveChip}>
              <View style={[styles.liveDot, { backgroundColor: leakDetected ? "#ef4444" : "#22c55e" }]} />
              <Text style={styles.liveText}>{leakDetected ? "LEAK ACTIVE" : "MONITORING"}</Text>
            </View>
            <Text style={styles.alertCount}>{firestoreAlerts.length} logs total</Text>
          </View>
        </LinearGradient>

        <LeakBanner leakDetected={leakDetected} />

        <FilterTabs active={activeTab} onChange={setActiveTab} counts={counts} />

        {filtered.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          filtered.map((alert, index) => (
            <AlertCard key={alert.id} alert={alert} index={index} />
          ))
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },
  scroll: { flex: 1 },
  content: { paddingBottom: 20 },
  header: { paddingTop: 58, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginBottom: 14 },
  eyebrow: { color: "#38bdf8", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 6 },
  title: { color: "#f1f5f9", fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  headerMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  liveChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#0f172a", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#1e293b", gap: 7 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { color: "#94a3b8", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  alertCount: { color: "#334155", fontSize: 12, fontWeight: "600" },
});