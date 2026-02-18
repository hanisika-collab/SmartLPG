import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cylinderId, setCylinderId] = useState("");

  const handleRegister = async () => {
    if (!name || !email || !password || !cylinderId) {
      Alert.alert("Error", "All fields are required");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters");
      return;
    }

    try {
      // Create auth user
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      // Store user profile
      await setDoc(doc(db, "users", uid), {
        name,
        email,
        cylinderId,
        createdAt: serverTimestamp(),
      });

      Alert.alert("Success", "Account created successfully");
      navigation.replace("Login");

    } catch (err) {
      console.log("Firebase Error:", err.code, err.message);

      let msg = "Registration failed";

      if (err.code === "auth/email-already-in-use") msg = "Email already registered";
      if (err.code === "auth/invalid-email") msg = "Invalid email format";
      if (err.code === "auth/weak-password") msg = "Weak password";

      Alert.alert("Register Failed", msg);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        style={styles.input}
        placeholder="Cylinder ID"
        value={cylinderId}
        onChangeText={setCylinderId}
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Create Account</Text>
      </TouchableOpacity>

      {/* Login redirect */}
      <View style={styles.loginWrap}>
        <Text style={styles.loginText}>Already have an account?</Text>
        <TouchableOpacity onPress={() => navigation.replace("Login")}>
          <Text style={styles.loginLink}> Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 25,
    backgroundColor: "#fff"
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 25,
    color: "#111"
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 15
  },
  button: {
    backgroundColor: "#16a34a",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold"
  },
  loginWrap: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18
  },
  loginText: {
    color: "#555",
    fontSize: 14
  },
  loginLink: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "700"
  }
});
