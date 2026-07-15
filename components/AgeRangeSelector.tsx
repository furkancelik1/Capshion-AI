import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GlassTheme } from "../constants/LiquidGlass";

const AGE_RANGES = ["18-24", "25-34", "35-44", "45+"] as const;

interface AgeRangeSelectorProps {
  value: string | null;
  onChange: (range: string) => void;
}

export default function AgeRangeSelector({
  value,
  onChange,
}: AgeRangeSelectorProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Yaş Aralığını Seç</Text>
      <View style={styles.row}>
        {AGE_RANGES.map((range) => {
          const selected = value === range;
          return (
            <TouchableOpacity
              key={range}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange(range)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {range}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: GlassTheme.textMuted,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  chip: {
    flex: 1,
    height: 44,
    borderRadius: GlassTheme.radiusSm,
    borderWidth: 1,
    borderColor: GlassTheme.border,
    backgroundColor: GlassTheme.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: {
    borderColor: GlassTheme.primary,
    backgroundColor: "rgba(122, 83, 255, 0.15)",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: GlassTheme.textMuted,
  },
  chipTextSelected: {
    color: GlassTheme.textMain,
  },
});
