import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DismissKeyboard from '../components/DismissKeyboard';
import { useAuth } from '../context/AuthContext';
import { ThemeColors, useThemeColors } from '../theme/colors';

export default function LoginScreen() {
  const { login } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DismissKeyboard>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Logo / Brand area */}
          <View style={styles.brandArea}>
            <View style={styles.logoCircle}>
              <Ionicons name="flash" size={36} color="#fff" />
            </View>
            <Text style={styles.brandName}>MotionRep</Text>
            <Text style={styles.brandTagline}>Field Sales Platform</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>

            {/* Email field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={emailFocused ? colors.accent : colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </View>

            {/* Password field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrapper, passwordFocused && styles.inputWrapperFocused]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={passwordFocused ? colors.accent : colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  secureTextEntry={!showPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(v => !v)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Sign in</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </DismissKeyboard>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    gradient: {
      flex: 1,
    },
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    brandArea: {
      alignItems: 'center',
      marginBottom: 32,
    },
    logoCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.35)',
    },
    brandName: {
      fontSize: 28,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.5,
    },
    brandTagline: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.75)',
      marginTop: 4,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    card: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 28,
      gap: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 12,
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 4,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      marginBottom: 24,
    },
    fieldGroup: {
      marginBottom: 16,
    },
    label: {
      color: colors.textSubtle,
      fontWeight: '600',
      fontSize: 13,
      marginBottom: 8,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    inputWrapperFocused: {
      borderColor: colors.accent,
      backgroundColor: colors.surface,
    },
    inputIcon: {
      paddingLeft: 14,
      paddingRight: 4,
    },
    input: {
      flex: 1,
      paddingHorizontal: 10,
      paddingVertical: 14,
      color: colors.text,
      fontSize: 15,
    },
    eyeButton: {
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.dangerSurface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 4,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      flex: 1,
    },
    button: {
      marginTop: 8,
      borderRadius: 14,
      overflow: 'hidden',
    },
    buttonDisabled: {
      opacity: 0.65,
    },
    buttonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 15,
      gap: 8,
    },
    buttonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
      letterSpacing: 0.3,
    },
  });
