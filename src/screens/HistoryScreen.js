import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db, auth } from "../firebase";

const HistoryScreen = () => {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const q = query(collection(db, "systemHistory", uid, "logs"), orderBy("timestamp", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const logs = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type || "SYSTEM",
          title: data.title || "System Event",
          message: data.message || "",
          status: data.status || "INFO",
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date()
        };
      });
      setHistoryData(logs);
      setLoading(false);
    }, (error) => {
      console.error("History listener error:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const getColor = (status) => {
    switch (status) {
      case "CRITICAL": return "#ff3b3b";
      case "WARNING":  return "#ff9800";
      case "NORMAL":   return "#4caf50";
      case "INFO":     return "#38ef7d";
      default:         return "#94a3b8";
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "PREDICTION": return "analytics";
      case "USAGE":      return "stats-chart";
      case "ALERT":      return "warning";
      case "LEAK":       return "flame";
      case "SYSTEM":     return "settings-outline";
      default:           return "document-text-outline";
    }
  };

// ... (Imports and Initial Setup stay the same)

  const renderItem = ({ item }) => {
  // Logic: Message-la irundhu usage weight-ah highlight pandrom
  const isUsageLog = item.type === "USAGE" || item.title.includes("Weight");

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <View style={[styles.iconContainer, { backgroundColor: `${getColor(item.status)}25` }]}>
          <Ionicons name={getIcon(item.type)} size={22} color={getColor(item.status)} />
        </View>
      </View>

      <View style={styles.middle}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {isUsageLog ? "Consumption Recorded" : "Hardware Activity"}
          </Text>
          {item.type === "PREDICTION" && (
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>AI ANALYTICS</Text>
            </View>
          )}
        </View>

        {/* Nee sonna maari Usage difference-ah highlight pandrom */}
        <Text style={styles.value}>
          {isUsageLog 
            ? `Amount Used: ${item.message}` // E.g., Amount Used: 0.050 kg
            : item.message.replace("tomorrow", "upcoming session")}
        </Text>

        <Text style={styles.time}>
          {item.timestamp.toLocaleString('en-IN', { 
            day: '2-digit', 
            month: 'short', 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          })}
        </Text>
      </View>

      <View style={[styles.statusDot, { backgroundColor: getColor(item.status) }]} />
    </View>
  );
};

// ... (Styles stay the same)
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#38ef7d" /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>System History</Text>
      {historyData.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="time-outline" size={50} color="#334155" />
          <Text style={styles.emptyText}>No logs recorded yet</Text>
          <Text style={styles.emptySub}>Sensor data and AI predictions will appear here once the system is active.</Text>
        </View>
      ) : (
        <FlatList data={historyData} keyExtractor={(item) => item.id} renderItem={renderItem} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} />
      )}
    </View>
  );
};

export default HistoryScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f1a", paddingHorizontal: 16, paddingTop: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0b0f1a" },
  header: { fontSize: 24, fontWeight: "900", color: "#fff", marginBottom: 20, letterSpacing: 0.5 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#161e31", borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#1e293b" },
  left: { marginRight: 12 },
  iconContainer: { padding: 10, borderRadius: 12 },
  middle: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center" },
  title: { color: "#fff", fontSize: 15, fontWeight: "700" },
  aiBadge: { backgroundColor: "#38ef7d", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, marginLeft: 8 },
  aiBadgeText: { color: "#000", fontSize: 10, fontWeight: "900" },
  value: { color: "#94a3b8", fontSize: 13, marginTop: 3, lineHeight: 18 },
  time: { color: "#64748b", fontSize: 11, marginTop: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 10 },
  emptyBox: { flex: 1, justifyContent: "center", alignItems: "center", marginTop: -50 },
  emptyText: { color: "#94a3b8", marginTop: 15, fontSize: 16, fontWeight: "700" },
  emptySub: { color: "#475569", fontSize: 13, textAlign: "center", marginTop: 8, paddingHorizontal: 40 },
});