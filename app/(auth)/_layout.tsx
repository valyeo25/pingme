import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  const [fontsLoaded] = useFonts({
    'Bricolage-Bold': require('../../assets/fonts/Bricolage-Bold.ttf'),
  });

  if (!fontsLoaded) return null;

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Welcome' }} />
      <Stack.Screen name="login" options={{ title: 'Login' }} />
      <Stack.Screen name="signup" options={{ title: 'Sign Up' }} />
    </Stack>
  );
}
