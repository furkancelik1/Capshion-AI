import * as Haptics from 'expo-haptics';
import { Pressable, PressableProps } from 'react-native';

interface HapticButtonProps extends PressableProps {
  activeOpacity?: number;
}

export default function HapticButton({ onPress, style, children, activeOpacity = 0.8, ...props }: HapticButtonProps) {
  const handlePress = (e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        pressed && { opacity: activeOpacity },
        style as any,
      ]}
      {...props}
    >
      {children}
    </Pressable>
  );
}
