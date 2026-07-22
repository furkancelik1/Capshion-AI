import { View } from "react-native";
import { TopTabs } from "expo-router/js-top-tabs";
import GlassHeader from "../../components/GlassHeader";
import FloatingTabBar from "../../components/FloatingTabBar";

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <TopTabs
        tabBarPosition="bottom"
        screenOptions={{
          swipeEnabled: true,
          animationEnabled: true,
        }}
        tabBar={(props: any) => <FloatingTabBar {...props} />}
      >
        <TopTabs.Screen name="index" />
        <TopTabs.Screen name="history" />
        <TopTabs.Screen name="profile" />
      </TopTabs>
      <GlassHeader />
    </View>
  );
}
