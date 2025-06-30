import auth from '@react-native-firebase/auth'; // ✅ Native SDK
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

const SignUpScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

    const signUpFn = async () => {
        if (!email || !password) {
            Alert.alert("Error", "Please enter both email and password");
        return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match");
        return;
        }
        try {
            await auth().createUserWithEmailAndPassword(email, password).then(() => {
                Alert.alert("Success", "User created successfully", [
                    {text: "OK", onPress: () => router.replace('/')}
                ]);
            });

        } catch (err: any) {
            Alert.alert("Error", err.message);
            console.log(err);
        };
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
                    <Text style = {styles.title}>Get Started</Text>
                    <TextInput
                        placeholder='Name'
                        style = {styles.input}
                    />
                    <TextInput
                    placeholder="Email"
                    autoCapitalize="none"
                    style={styles.input}
                    keyboardType="email-address"
                    value={email}
                    onChangeText={text => setEmail(text)}
                    />
                    <TextInput
                    placeholder="Password"
                    autoCapitalize="none"
                    style={styles.input}
                    secureTextEntry
                    textContentType="oneTimeCode"
                    autoComplete="off"
                    importantForAutofill="no"
                    value={password}
                    onChangeText={text => setPassword(text)}
                    />
                    <TextInput
                    placeholder="Confirm Password"
                    autoCapitalize="none"
                    style={styles.input}
                    secureTextEntry
                    textContentType="oneTimeCode"
                    autoComplete="off"
                    importantForAutofill="no"
                    value={confirmPassword}
                    onChangeText={text => setConfirmPassword(text)}
                    />

                    <TouchableOpacity
                    style={styles.signUpButtonBox}
                    onPress = {signUpFn}
                    >
                        <Text style={styles.buttonText}>Sign Up</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </ImageBackground>
    );
};

export default SignUpScreen;

const styles = StyleSheet.create({
    background: {
        flex: 1,
    },
    container: {
        flexDirection: 'row',
        padding: 10
    },
    logo: {
        width: 100,
        height: 100,
        marginTop: 10
    },
    scrollContainer: {
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingBottom: 40,
    },
    title: {
        fontSize: 39,
        fontFamily: "Bricolage-Bold",
        marginTop: 20,
        marginBottom: 20
    },
    input: {
        height: 50,
        backgroundColor: 'rgba(255,255,255,0.9)',
        marginBottom: 15,
        marginTop: 5,
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
