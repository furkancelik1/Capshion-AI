import * as Haptics from 'expo-haptics';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface HapticButtonProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: (e: any) => void;
  disabled?: boolean;
  activeOpacity?: number;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

export default function HapticButton({ onPress, style, children, activeOpacity = 0.8, disabled, pointerEvents }: HapticButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.92, { damping: 10, stiffness: 200 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 8, stiffness: 150 });
  };

  const handlePress = (e: any) => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.(e);
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      pointerEvents={pointerEvents}
      style={style}
    >
      <Animated.View style={animatedStyle}>
        {children}
      </Animated.View>
    </Pressable>
  );
}