import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db, auth } from "../firebase";

const HistoryScreen = () => {
  const [historyData, setHistoryData] = useState([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;

    const q = query(
      collection(db, "systemHistory", uid, "logs"),
      orderBy("timestamp", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setHistoryData([]);
          return;
        }

        const logs = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type || "SYSTEM",
            title: data.title || "System Event",
            message: data.message || "",
            status: data.status || "INFO",
            timestamp: data.timestamp?.toDate
              ? data.timestamp.toDate()
              : new Date()
          };
        });

        setHistoryData(logs);
      },
      (error) => {
        console.error("History listener error:", error);
      }
    );

    return () => unsub();
  }, []);

  const getColor = (status) => {
    switch (status) {
      case "CRITICAL": return "#ff3b3b";
      case "WARNING":  return "#ff9800";
      case "NORMAL":   return "#4caf50";
      case "INFO":     return "#2196f3";
      default:         return "#999";
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "USAGE": return "stats-chart";
      case "ALERT": return "warning";
      case "SYSTEM": return "settings";
      case "PREDICTION": return "analytics";
      case "LEAK": return "flame";
      default: return "document-text";
    }
  };

  const formatTime = (dateObj) => {
    if (!(dateObj instanceof Date)) return "now";
    return dateObj.toLocaleString();
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.left}>
        <Ionicons
          name={getIcon(item.type)}
          size={24}
          color={getColor(item.status)}
        />
      </View>

      <View style={styles.middle}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.value}>{item.message}</Text>
        <Text style={styles.time}>{formatTime(item.timestamp)}</Text>
      </View>

      <View
        style={[
          styles.statusDot,
          { backgroundColor: getColor(item.status) },
        ]}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>System History</Text>

      {historyData.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="time-outline" size={40} color="#64748b" />
          <Text style={styles.emptyText}>No system logs yet</Text>
          <Text style={styles.emptySub}>
            Waiting for sensor, prediction, or alert events
          </Text>
        </View>
      ) : (
        <FlatList
          data={historyData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default HistoryScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0f1a",
    padding: 16,
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141a2e",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  left: {
    width: 40,
    alignItems: "center",
  },
  middle: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  value: {
    color: "#cfd8dc",
    fontSize: 13,
    marginTop: 2,
  },
  time: {
    color: "#8fa3b8",
    fontSize: 11,
    marginTop: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  emptyBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.8,
  },
  emptyText: {
    color: "#94a3b8",
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
  },
  emptySub: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 6,
  },
});
