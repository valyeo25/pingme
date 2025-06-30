import auth from '@react-native-firebase/auth';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity
} from 'react-native';

export const unstable_settings = {
  headerShown: false,
};

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const loginFn = async () => {
    setLoading(true)
    try {
      await auth().signInWithEmailAndPassword(email, password);
      router.replace('/(tabs)');
      Alert.alert('Welcome!');
    } catch (err: any) {
      let message = 'Something went wrong';
      if (err.code === 'auth/invalid-credential') {
        message = 'Incorrect email or password. Please try again.';
      } else if (err.code === 'auth/wrong-password') {
        message = 'No password entered. Please try again.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Invalid email address. Please try again.';
      } else if (err.message) {
        message = err.message;
      }
      Alert.alert('Login Failed', message)
    }
    setLoading(false);
  };

  return (
    <ImageBackground
      source={require('../../assets/images/ImageBackground.jpg')}
      style={styles.background}
      imageStyle={{ opacity: 0.2 }}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >   
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={require('../../assets/images/finalLogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <TextInput
            placeholder="Email"
            autoCapitalize="none"
            style={styles.input}
            keyboardType="email-address"
            value = {email}
            onChangeText = {setEmail}
          />
          <TextInput
            placeholder="Password"
            autoCapitalize="none"
            style={styles.input}
            secureTextEntry
            value = {password}
            onChangeText = {setPassword}
          />
          <TouchableOpacity
            style={styles.loginButtonBox}
            onPress={loginFn}
            activeOpacity={1}
          >
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signUpButtonBox}
            onPress={() => router.push('/(auth)/signup')}
          >
            <Text style={styles.buttonText}>Sign Up</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  logo: {
    marginTop: 80,
    width: 300,
    height: 200
  },
  scrollContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  input: {
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.9)',
    marginBottom: 15,
    borderRadius: 8,
    paddingHorizontal: 15,
    width: '100%',

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
    loginButtonBox: {
    backgroundColor: '#0d74cc',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
    width: '100%',
  },
    signUpButtonBox: {
    backgroundColor: '#000',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    elevation: 4,
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
