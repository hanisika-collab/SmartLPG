import { View, Text, StyleSheet, Animated } from "react-native";
import { useEffect, useRef } from "react";

export default function SplashScreen({ navigation }) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        navigation.replace("Login");
      }, 1200);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require("../assets/Logolpg.jpeg")}
        style={[
          styles.logo,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      />

      <Text style={styles.appName}>Smart LPG</Text>
      <Text style={styles.tagline}>Smart Gas. Safe Homes.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 140,
    height: 140,
    resizeMode: "contain",
  },
  appName: {
    marginTop: 18,
    fontSize: 26,
    fontWeight: "bold",
    color: "#0f172a",
  },
  tagline: {
    marginTop: 6,
    fontSize: 14,
    color: "#475569",
  },
});
