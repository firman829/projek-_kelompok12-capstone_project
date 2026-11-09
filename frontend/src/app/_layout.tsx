import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { CameraOverlayProvider } from '@/components/camera-overlay-context';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <CameraOverlayProvider>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }} />
      </CameraOverlayProvider>
    </ThemeProvider>
  );
}
