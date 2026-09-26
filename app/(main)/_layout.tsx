import { Stack } from 'expo-router';

// TODO: Global overlays — Voice Bottom Sheet, SOS overlay, System Alerts.
export default function MainLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
