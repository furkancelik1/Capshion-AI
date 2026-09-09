import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

interface PremiumBadgeProps {
  isPremium: boolean;
}

export default function PremiumBadge({ isPremium }: PremiumBadgeProps) {
  if (!isPremium) return null;

  return (
    <LinearGradient
      colors={["#D4AF37", "#F4E5A1"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.badge}
    >
      <View style={styles.content}>
        <MaterialCommunityIcons name="crown" size={12} color="#5C4415" />
        <Text style={styles.text}>PREMIUM</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  badge: {
    height: 26,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
  },
  text: {
    fontSize: 10,
    fontWeight: "800",
    color: "#5C4415",
    letterSpacing: 0.6,
  },
});
