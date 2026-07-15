import { Text as DefaultText, View as DefaultView } from 'react-native';
import { GlassTheme } from '@/constants/LiquidGlass';

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText['props'];
export type ViewProps = ThemeProps & DefaultView['props'];

export function useThemeColor(
  props: { light?: string; dark?: string },
) {
  return props.light ?? props.dark ?? GlassTheme.textMain;
}

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor });

  return <DefaultText style={[{ color }, style]} {...otherProps} />;
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const backgroundColor = lightColor ?? darkColor ?? 'transparent';

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
