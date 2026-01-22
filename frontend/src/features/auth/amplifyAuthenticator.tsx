import { authenticatorTextUtil, getErrors } from '@aws-amplify/ui';
import type { ThemeProvider } from '@aws-amplify/ui-react-native/dist';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react-native/dist';
import { icons } from '@aws-amplify/ui-react-native/dist/assets';
import { FederatedProviderButtons } from '@aws-amplify/ui-react-native/dist/Authenticator/common';
import {
  Button as AmplifyButton,
  PhoneNumberField,
  TextField,
} from '@aws-amplify/ui-react-native/dist/primitives';
import React from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Image, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { styles } from '../../../App.styles';
import { APP_COLORS, PALETTE } from '../../theme/colors';

type CaretColors = { selectionColor: string; cursorColor?: string };

type AmplifyFieldLike = Record<string, unknown> & {
  name?: unknown;
  type?: unknown;
  required?: unknown;
  value?: unknown;
  labelHidden?: unknown;
  label?: unknown;
  onFocus?: (event: unknown) => void;
  onBlur?: (event: unknown) => void;
  onChange?: (event: unknown) => void;
  onChangeText?: (value: unknown) => void;
};

type AmplifyFormFieldsPropBag = {
  [key: string]: unknown;
  fieldContainerStyle?: StyleProp<ViewStyle>;
  fieldErrorsContainer?: StyleProp<ViewStyle>;
  fieldErrorStyle?: StyleProp<TextStyle>;
  fieldStyle?: Record<string, unknown>;
  fields?: unknown;
  isPending?: boolean;
  style?: StyleProp<ViewStyle>;
  validationErrors?: unknown;
};

function normalizeErrorsArg(v: unknown): string | string[] {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

function injectCaretColors(fields: unknown, caret: CaretColors): AmplifyFieldLike[] {
  const arr: unknown[] = Array.isArray(fields) ? fields : [];
  return arr.map((f) => {
    const rec = typeof f === 'object' && f != null ? (f as Record<string, unknown>) : {};
    return {
      ...rec,
      selectionColor: caret.selectionColor,
      cursorColor: caret.cursorColor,
    };
  });
}

function getWebAuthPasswordFocusStyle(isDark: boolean): ViewStyle {
  // Match `AppTextInput` web focus style so auth forms feel consistent.
  return {
    outlineStyle: 'solid',
    outlineWidth: 0,
    outlineColor: 'transparent',
    boxShadow: `inset 0px 0px 0px ${isDark ? 2 : 1}px ${isDark ? PALETTE.white : PALETTE.black}`,
  } as const;
}

function WebPasswordField({
  isDark,
  label,
  placeholder,
  value,
  disabled,
  hasError,
  caret,
  showPassword,
  setShowPassword,
  webMarginBottom,
  onChangeText,
  onBlur,
  onFocus,
  focused,
  setFocused,
}: {
  isDark: boolean;
  label?: string;
  placeholder?: string;
  value: string;
  disabled: boolean;
  hasError: boolean;
  caret: CaretColors;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  webMarginBottom?: number;
  onChangeText?: (t: string) => void;
  onBlur?: (event: unknown) => void;
  onFocus?: (event: unknown) => void;
  focused: boolean;
  setFocused: (v: boolean) => void;
}): React.JSX.Element {
  const borderColor = hasError
    ? isDark
      ? APP_COLORS.dark.status.errorText
      : APP_COLORS.light.status.errorText
    : isDark
      ? APP_COLORS.dark.border.default
      : APP_COLORS.light.border.subtle;

  return (
    <View
      style={{
        width: '100%',
        alignSelf: 'stretch',
        // Match Amplify's typical vertical rhythm between fields.
        // Use bottom margin so we don't inflate the gap *above* the password field.
        marginBottom:
          Platform.OS === 'web'
            ? typeof webMarginBottom === 'number' && Number.isFinite(webMarginBottom)
              ? webMarginBottom
              : 10
            : 0,
      }}
    >
      {label ? (
        <Text
          style={{
            color: isDark ? APP_COLORS.dark.text.body : APP_COLORS.light.text.body,
            fontWeight: '700',
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={[
          {
            width: '100%',
            alignSelf: 'stretch',
            flexDirection: 'row',
            alignItems: 'center',
            height: Platform.OS === 'web' ? 48 : undefined,
            borderRadius: 12,
            borderWidth: 1,
            borderColor,
            backgroundColor: isDark ? APP_COLORS.dark.bg.header : APP_COLORS.light.bg.surface2,
          },
          focused ? getWebAuthPasswordFocusStyle(isDark) : null,
          disabled ? ({ opacity: 0.55 } as const) : null,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={(t) => onChangeText?.(t)}
          placeholder={placeholder}
          placeholderTextColor={isDark ? PALETTE.slate400 : PALETTE.slate350}
          selectionColor={caret.selectionColor}
          cursorColor={caret.cursorColor}
          secureTextEntry={!showPassword}
          editable={!disabled}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            flexGrow: 1,
            flexShrink: 1,
            minWidth: 0,
            paddingVertical: Platform.OS === 'web' ? 0 : 12,
            paddingHorizontal: 12,
            color: isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary,
            fontSize: Platform.OS === 'web' ? 16 : 16,
            lineHeight: Platform.OS === 'web' ? 20 : undefined,
            height: Platform.OS === 'web' ? 48 : undefined,
            textAlignVertical: Platform.OS === 'web' ? ('center' as const) : undefined,
            // RN-web: suppress default focus outline; the wrapper draws the focus ring.
            // `outlineStyle: 'none'` is not in RN TextStyle typings.
            ...(Platform.OS === 'web'
              ? ({
                  outlineStyle: 'solid',
                  outlineWidth: 0,
                  outlineColor: 'transparent',
                } as const)
              : null),
          }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          disabled={disabled}
          onPress={() => setShowPassword((v) => !v)}
          style={({ pressed }) => [
            { paddingHorizontal: 12, paddingVertical: 8, opacity: pressed ? 0.8 : 1 },
            disabled ? { opacity: 0.5 } : null,
          ]}
        >
          <Image
            source={showPassword ? icons.visibilityOn : icons.visibilityOff}
            resizeMode="contain"
            tintColor={isDark ? APP_COLORS.dark.text.body : APP_COLORS.light.text.muted}
            style={{ width: 18, height: 18 }}
          />
        </Pressable>
      </View>
    </View>
  );
}

// iOS workaround: multiple secureTextEntry inputs can glitch unless we insert a hidden TextInput
// after each secure input.
const HIDDEN_INPUT_PROPS = {
  accessibilityElementsHidden: true,
  style: {
    backgroundColor: 'transparent',
    height: 0.1,
    width: 0.1,
    pointerEvents: 'none' as const,
  },
};

const LinkedConfirmResetPasswordFormFields = ({
  isDark,
  caret,
  fieldContainerStyle,
  fieldErrorsContainer,
  fieldErrorStyle,
  fieldStyle,
  fields,
  isPending = false,
  style,
  validationErrors,
}: AmplifyFormFieldsPropBag & {
  isDark: boolean;
  caret: CaretColors;
}): React.JSX.Element => {
  const [showPassword, setShowPassword] = React.useState(false);
  const [focusedPasswordFieldName, setFocusedPasswordFieldName] = React.useState<string>('');
  const webFullWidth =
    Platform.OS === 'web' ? ({ width: '100%', alignSelf: 'stretch' } as const) : null;
  const webFieldFullWidthObj =
    Platform.OS === 'web'
      ? ({ width: '100%', alignSelf: 'stretch', flexGrow: 1, flexShrink: 1, minWidth: 0 } as const)
      : null;
  const webAuthFieldStyleObj =
    Platform.OS === 'web'
      ? ({
          ...(fieldStyle || {}),
          ...(webFieldFullWidthObj || {}),
          height: 48,
          fontSize: 16,
          lineHeight: 20,
          // On web, keep height stable and let the wrapper center the text.
          paddingVertical: 0,
          paddingHorizontal: 12,
        } as const)
      : null;

  const validationRec =
    typeof validationErrors === 'object' && validationErrors != null
      ? (validationErrors as Record<string, unknown>)
      : {};

  const formFields = (Array.isArray(fields) ? fields : []).map((f) => {
    const rec: AmplifyFieldLike = typeof f === 'object' && f != null ? (f as AmplifyFieldLike) : {};
    const name = String(rec.name ?? '');
    const type = String(rec.type ?? '');
    const { name: _name, type: _type, value: rawValue, ...field } = rec;

    const errors = validationErrors ? getErrors(normalizeErrorsArg(validationRec[name])) : [];
    const hasError = errors?.length > 0;
    const isPassword = type === 'password';

    const FieldComp = isPassword ? TextField : type === 'phone' ? PhoneNumberField : TextField;

    // Web warning fix: prevent <input> from flipping between uncontrolled/controlled
    // when Amplify initializes `value` as undefined before first change.
    const valueProp =
      rawValue == null || typeof rawValue === 'string' ? { value: rawValue ?? '' } : null;

    const endAccessory = isPassword ? (
      // Web warning fix: Amplify's Icon uses `style.resizeMode` + `style.tintColor` (deprecated on RN-web).
      // Use our own Image with `resizeMode`/`tintColor` props instead.
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
        disabled={isPending}
        onPress={() => setShowPassword((v) => !v)}
        style={({ pressed }) => [
          { padding: 8, opacity: pressed ? 0.8 : 1 },
          isPending ? { opacity: 0.5 } : null,
        ]}
      >
        <Image
          source={showPassword ? icons.visibilityOn : icons.visibilityOff}
          resizeMode="contain"
          tintColor={isDark ? APP_COLORS.dark.text.body : APP_COLORS.light.text.muted}
          style={{ width: 18, height: 18 }}
        />
      </Pressable>
    ) : undefined;

    return (
      <React.Fragment key={name}>
        {Platform.OS === 'web' && isPassword ? (
          <View style={[fieldContainerStyle, webFullWidth]}>
            <WebPasswordField
              isDark={isDark}
              label={typeof rec.label === 'string' ? rec.label : 'Password'}
              placeholder={
                typeof (field as any)?.placeholder === 'string'
                  ? (field as any).placeholder
                  : 'Enter your Password'
              }
              value={String((valueProp as any)?.value ?? '')}
              disabled={!!isPending}
              hasError={!!hasError}
              caret={caret}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              webMarginBottom={
                String(name || '')
                  .toLowerCase()
                  .includes('confirm')
                  ? 6
                  : 10
              }
              onChangeText={(t) => (field as any)?.onChangeText?.(t)}
              onFocus={(e) => {
                setFocusedPasswordFieldName(name);
                (field as any)?.onFocus?.(e);
              }}
              onBlur={(e) => {
                if (focusedPasswordFieldName === name) setFocusedPasswordFieldName('');
                (field as any)?.onBlur?.(e);
              }}
              focused={focusedPasswordFieldName === name}
              setFocused={(v) => {
                if (v) setFocusedPasswordFieldName(name);
                else if (focusedPasswordFieldName === name) setFocusedPasswordFieldName('');
              }}
            />
          </View>
        ) : (
          <FieldComp
            {...(field as React.ComponentProps<typeof TextField>)}
            {...(valueProp || {})}
            disabled={isPending}
            error={hasError}
            // On web, Amplify's TextField doesn't always merge style arrays for the underlying <input>.
            // Provide a single merged object to ensure full-width inputs.
            fieldStyle={
              Platform.OS === 'web'
                ? (webAuthFieldStyleObj as unknown as Record<string, unknown>)
                : fieldStyle
            }
            style={[fieldContainerStyle, webFullWidth]}
            selectionColor={caret.selectionColor}
            cursorColor={caret.cursorColor}
            secureTextEntry={isPassword ? !showPassword : undefined}
            endAccessory={endAccessory}
          />
        )}
        {Platform.OS === 'ios' && isPassword ? <TextInput {...HIDDEN_INPUT_PROPS} /> : null}
        {errors?.length ? (
          <View style={fieldErrorsContainer}>
            {errors.map((e: string) => (
              <Text key={`${name}:${e}`} style={fieldErrorStyle}>
                {e}
              </Text>
            ))}
          </View>
        ) : null}
      </React.Fragment>
    );
  });

  return <View style={[style, webFullWidth]}>{formFields}</View>;
};

const LinkedSignUpFormFields = ({
  isDark,
  caret,
  fieldContainerStyle,
  fieldErrorsContainer,
  fieldErrorStyle,
  fieldStyle,
  fields,
  isPending = false,
  style,
  validationErrors,
}: AmplifyFormFieldsPropBag & { isDark: boolean; caret: CaretColors }): React.JSX.Element => {
  const [showPassword, setShowPassword] = React.useState(false);
  const [focusedPasswordFieldName, setFocusedPasswordFieldName] = React.useState<string>('');
  const MAX_USERNAME_LEN = 21;
  const webFullWidth =
    Platform.OS === 'web' ? ({ width: '100%', alignSelf: 'stretch' } as const) : null;
  const webFieldFullWidthObj =
    Platform.OS === 'web'
      ? ({ width: '100%', alignSelf: 'stretch', flexGrow: 1, flexShrink: 1, minWidth: 0 } as const)
      : null;
  const webAuthFieldStyleObj =
    Platform.OS === 'web'
      ? ({
          ...(fieldStyle || {}),
          ...(webFieldFullWidthObj || {}),
          height: 48,
          fontSize: 16,
          lineHeight: 20,
          paddingVertical: 0,
          paddingHorizontal: 12,
        } as const)
      : null;

  const validationRec =
    typeof validationErrors === 'object' && validationErrors != null
      ? (validationErrors as Record<string, unknown>)
      : {};

  const formFields = (Array.isArray(fields) ? fields : []).map((f) => {
    const rec: AmplifyFieldLike = typeof f === 'object' && f != null ? (f as AmplifyFieldLike) : {};
    const name = String(rec.name ?? '');
    const type = String(rec.type ?? '');
    const { name: _name, type: _type, value: rawValue, ...field } = rec;
    const errors = validationErrors ? getErrors(normalizeErrorsArg(validationRec[name])) : [];
    const hasError = errors?.length > 0;
    const isPassword = type === 'password';

    const FieldComp = type === 'phone' ? PhoneNumberField : TextField;

    // Web warning fix: prevent <input> from flipping between uncontrolled/controlled
    // when Amplify initializes `value` as undefined before first change.
    const valueProp =
      rawValue == null || typeof rawValue === 'string' ? { value: rawValue ?? '' } : null;

    const endAccessory = isPassword ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
        disabled={isPending}
        onPress={() => setShowPassword((v) => !v)}
        style={({ pressed }) => [
          { padding: 8, opacity: pressed ? 0.8 : 1 },
          isPending ? { opacity: 0.5 } : null,
        ]}
      >
        <Image
          source={showPassword ? icons.visibilityOn : icons.visibilityOff}
          resizeMode="contain"
          tintColor={isDark ? APP_COLORS.dark.text.body : APP_COLORS.light.text.muted}
          style={{ width: 18, height: 18 }}
        />
      </Pressable>
    ) : undefined;

    return (
      <React.Fragment key={name}>
        {Platform.OS === 'web' && isPassword ? (
          <View style={[fieldContainerStyle, webFullWidth]}>
            <WebPasswordField
              isDark={isDark}
              label={typeof rec.label === 'string' ? rec.label : 'Password'}
              placeholder={
                typeof (field as any)?.placeholder === 'string'
                  ? (field as any).placeholder
                  : 'Enter your Password'
              }
              value={String((valueProp as any)?.value ?? '')}
              disabled={!!isPending}
              hasError={!!hasError}
              caret={caret}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              webMarginBottom={
                String(name || '')
                  .toLowerCase()
                  .includes('confirm')
                  ? 6
                  : 10
              }
              onChangeText={(t) => (field as any)?.onChangeText?.(t)}
              onFocus={(e) => {
                setFocusedPasswordFieldName(name);
                (field as any)?.onFocus?.(e);
              }}
              onBlur={(e) => {
                if (focusedPasswordFieldName === name) setFocusedPasswordFieldName('');
                (field as any)?.onBlur?.(e);
              }}
              focused={focusedPasswordFieldName === name}
              setFocused={(v) => {
                if (v) setFocusedPasswordFieldName(name);
                else if (focusedPasswordFieldName === name) setFocusedPasswordFieldName('');
              }}
            />
          </View>
        ) : (
          <FieldComp
            {...(field as React.ComponentProps<typeof TextField>)}
            {...(valueProp || {})}
            {...(name === 'preferred_username'
              ? {
                  // Prevent ultra-long usernames; backend enforces too.
                  maxLength: MAX_USERNAME_LEN,
                }
              : null)}
            disabled={isPending}
            error={hasError}
            fieldStyle={
              Platform.OS === 'web'
                ? (webAuthFieldStyleObj as unknown as Record<string, unknown>)
                : fieldStyle
            }
            style={[
              fieldContainerStyle,
              webFullWidth,
              Platform.OS === 'web' && name === 'preferred_username'
                ? ({ marginTop: -4 } as const)
                : null,
            ]}
            selectionColor={caret.selectionColor}
            cursorColor={caret.cursorColor}
            secureTextEntry={isPassword ? !showPassword : undefined}
            endAccessory={endAccessory}
          />
        )}
        {Platform.OS === 'ios' && isPassword ? <TextInput {...HIDDEN_INPUT_PROPS} /> : null}
        {errors?.length ? (
          <View style={fieldErrorsContainer}>
            {errors.map((e: string) => (
              <Text key={`${name}:${e}`} style={fieldErrorStyle}>
                {e}
              </Text>
            ))}
          </View>
        ) : null}
      </React.Fragment>
    );
  });

  return <View style={[style, webFullWidth]}>{formFields}</View>;
};

const LinkedSignInFormFields = ({
  isDark,
  caret,
  fieldContainerStyle,
  fieldErrorsContainer,
  fieldErrorStyle,
  fieldStyle,
  fields,
  isPending = false,
  style,
  validationErrors,
}: AmplifyFormFieldsPropBag & { isDark: boolean; caret: CaretColors }): React.JSX.Element => {
  const [showPassword, setShowPassword] = React.useState(false);
  const [focusedPasswordFieldName, setFocusedPasswordFieldName] = React.useState<string>('');
  const webFullWidth =
    Platform.OS === 'web' ? ({ width: '100%', alignSelf: 'stretch' } as const) : null;
  const webFieldFullWidthObj =
    Platform.OS === 'web'
      ? ({ width: '100%', alignSelf: 'stretch', flexGrow: 1, flexShrink: 1, minWidth: 0 } as const)
      : null;
  const webAuthFieldStyleObj =
    Platform.OS === 'web'
      ? ({
          ...(fieldStyle || {}),
          ...(webFieldFullWidthObj || {}),
          height: 48,
          fontSize: 16,
          lineHeight: 20,
          paddingVertical: 0,
          paddingHorizontal: 12,
        } as const)
      : null;

  const validationRec =
    typeof validationErrors === 'object' && validationErrors != null
      ? (validationErrors as Record<string, unknown>)
      : {};

  const formFields = (Array.isArray(fields) ? fields : []).map((f) => {
    const rec: AmplifyFieldLike = typeof f === 'object' && f != null ? (f as AmplifyFieldLike) : {};
    const name = String(rec.name ?? '');
    const type = String(rec.type ?? '');
    const { name: _name, type: _type, value: rawValue, ...field } = rec;
    const errors = validationErrors ? getErrors(normalizeErrorsArg(validationRec[name])) : [];
    const hasError = errors?.length > 0;
    const isPassword = type === 'password';

    const FieldComp = type === 'phone' ? PhoneNumberField : TextField;

    // Web warning fix: prevent <input> from flipping between uncontrolled/controlled
    // when Amplify initializes `value` as undefined before first change.
    const valueProp =
      rawValue == null || typeof rawValue === 'string' ? { value: rawValue ?? '' } : null;

    const endAccessory = isPassword ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
        disabled={isPending}
        onPress={() => setShowPassword((v) => !v)}
        style={({ pressed }) => [
          { padding: 8, opacity: pressed ? 0.8 : 1 },
          isPending ? { opacity: 0.5 } : null,
        ]}
      >
        <Image
          // Reflect current state: "eye open" means visible.
          source={showPassword ? icons.visibilityOn : icons.visibilityOff}
          resizeMode="contain"
          tintColor={isDark ? APP_COLORS.dark.text.body : APP_COLORS.light.text.muted}
          style={{ width: 18, height: 18 }}
        />
      </Pressable>
    ) : undefined;

    return (
      <React.Fragment key={name}>
        {Platform.OS === 'web' && isPassword ? (
          <View style={[fieldContainerStyle, webFullWidth]}>
            <WebPasswordField
              isDark={isDark}
              label={typeof rec.label === 'string' ? rec.label : 'Password'}
              placeholder={
                typeof (field as any)?.placeholder === 'string'
                  ? (field as any).placeholder
                  : 'Enter your Password'
              }
              value={String((valueProp as any)?.value ?? '')}
              disabled={!!isPending}
              hasError={!!hasError}
              caret={caret}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              webMarginBottom={10}
              onChangeText={(t) => (field as any)?.onChangeText?.(t)}
              onFocus={(e) => {
                setFocusedPasswordFieldName(name);
                (field as any)?.onFocus?.(e);
              }}
              onBlur={(e) => {
                if (focusedPasswordFieldName === name) setFocusedPasswordFieldName('');
                (field as any)?.onBlur?.(e);
              }}
              focused={focusedPasswordFieldName === name}
              setFocused={(v) => {
                if (v) setFocusedPasswordFieldName(name);
                else if (focusedPasswordFieldName === name) setFocusedPasswordFieldName('');
              }}
            />
          </View>
        ) : (
          <FieldComp
            {...(field as React.ComponentProps<typeof TextField>)}
            {...(valueProp || {})}
            disabled={isPending}
            error={hasError}
            fieldStyle={
              Platform.OS === 'web'
                ? (webAuthFieldStyleObj as unknown as Record<string, unknown>)
                : fieldStyle
            }
            style={[fieldContainerStyle, webFullWidth]}
            selectionColor={caret.selectionColor}
            cursorColor={caret.cursorColor}
            secureTextEntry={isPassword ? !showPassword : undefined}
            endAccessory={endAccessory}
          />
        )}
        {Platform.OS === 'ios' && isPassword ? <TextInput {...HIDDEN_INPUT_PROPS} /> : null}
        {errors?.length ? (
          <View style={fieldErrorsContainer}>
            {errors.map((e: string) => (
              <Text key={`${name}:${e}`} style={fieldErrorStyle}>
                {e}
              </Text>
            ))}
          </View>
        ) : null}
      </React.Fragment>
    );
  });

  return <View style={[style, webFullWidth]}>{formFields}</View>;
};

function useWebAuthFieldValues({
  fields = [],
  handleBlur,
  handleChange,
  handleSubmit,
  validationErrors,
}: {
  componentName: string;
  fields: unknown[];
  handleBlur?: (payload: { name: string; value: string }) => void;
  handleChange?: (payload: { name: string; value: string }) => void;
  handleSubmit?: (payload: Record<string, string>) => void;
  validationErrors?: unknown;
}): {
  disableFormSubmit: boolean;
  fieldsWithHandlers: AmplifyFieldLike[];
  fieldValidationErrors: unknown;
  handleFormSubmit: () => void;
} {
  const [values, setValues] = React.useState<Record<string, string>>({});

  const toStr = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

  const fieldsWithHandlers = React.useMemo(() => {
    const arr = Array.isArray(fields) ? fields : [];
    return arr.map((field): AmplifyFieldLike => {
      const rec: AmplifyFieldLike =
        typeof field === 'object' && field != null ? (field as AmplifyFieldLike) : {};
      const name = String(rec.name ?? '');
      if (!name) return rec;

      const reportChange = (valueRaw: unknown) => {
        const value = toStr(valueRaw);
        handleChange?.({ name, value });
        setValues((prev) => ({ ...prev, [name]: value }));
      };

      const onBlur = (event: unknown) => {
        const evRec =
          typeof event === 'object' && event != null ? (event as Record<string, unknown>) : {};
        const nativeEvent =
          typeof evRec.nativeEvent === 'object' && evRec.nativeEvent != null
            ? (evRec.nativeEvent as Record<string, unknown>)
            : {};
        const textValue = values[name] ?? toStr(nativeEvent.text);
        rec.onBlur?.(event);
        handleBlur?.({ name, value: textValue });
      };

      const onChangeText = (value: unknown) => {
        const v = toStr(value);
        rec.onChangeText?.(v);
        reportChange(v);
      };

      const onChange = (event: unknown) => {
        const evRec =
          typeof event === 'object' && event != null ? (event as Record<string, unknown>) : {};
        const nativeEvent =
          typeof evRec.nativeEvent === 'object' && evRec.nativeEvent != null
            ? (evRec.nativeEvent as Record<string, unknown>)
            : {};
        rec.onChange?.(event);
        reportChange(nativeEvent.text ?? '');
      };

      const value = values[name] ?? '';

      return {
        ...rec,
        // keep labelHidden semantics from Amplify: if the label is hidden, omit it
        label: rec?.labelHidden ? undefined : rec?.label,
        name,
        value,
        onBlur,
        onChange,
        onChangeText,
      };
    });
  }, [fields, handleBlur, handleChange, values]);

  const disableFormSubmit = React.useMemo(() => {
    // Minimal behavior: required fields must be non-empty. (Matches Amplify’s default behavior.)
    return fieldsWithHandlers.some((f) => {
      if (!f || typeof f !== 'object') return false;
      if (!f.required) return false;
      const name = String(f.name ?? '');
      return !toStr(values[name]).trim();
    });
  }, [fieldsWithHandlers, values]);

  const handleFormSubmit = React.useCallback(() => {
    const submitValue = fieldsWithHandlers.reduce((acc: Record<string, string>, f) => {
      if (!f || typeof f !== 'object') return acc;
      const name = String(f.name ?? '');
      if (!name) return acc;
      const value = toStr(values[name] ?? f.value ?? '');
      if (f.type === 'phone') {
        // Best-effort mimic of Amplify behavior: split dial code.
        acc.country_code = value.substring(0, 3);
        acc[name] = value.substring(3);
      } else {
        acc[name] = value;
      }
      return acc;
    }, {});
    handleSubmit?.(submitValue);
  }, [fieldsWithHandlers, handleSubmit, values]);

  return {
    disableFormSubmit,
    fieldsWithHandlers,
    fieldValidationErrors: { ...(validationErrors || {}) },
    handleFormSubmit,
  };
}

// Web-only Authenticator content: match input insets and make primary CTA full-width.
// Also avoids Amplify's `ErrorMessage` icon (which triggers RN-web `Image style.*` deprecation warnings).
type WebAuthButtons = {
  primary?: React.ComponentProps<typeof AmplifyButton>;
  secondary?: React.ComponentProps<typeof AmplifyButton>;
  links?: Array<React.ComponentProps<typeof AmplifyButton>>;
};

type FederatedButtonsProps = React.ComponentProps<typeof FederatedProviderButtons>;
type SocialProvidersProp = FederatedButtonsProps['socialProviders'];
type ToFederatedSignInProp = FederatedButtonsProps['toFederatedSignIn'];

type WebAuthContentProps = Record<string, unknown> & {
  body?: React.ReactNode;
  buttons?: WebAuthButtons;
  error?: unknown;
  fields?: unknown;
  Footer: React.ComponentType<{ style?: unknown }>;
  FormFields: React.ComponentType<AmplifyFormFieldsPropBag>;
  Header: React.ComponentType<{ style?: unknown; children?: React.ReactNode }>;
  headerText: string;
  isDark: boolean;
  isPending?: boolean;
  validationErrors?: unknown;
};

const WebAuthContent = ({
  body,
  buttons,
  error,
  fields,
  Footer,
  FormFields,
  Header,
  headerText,
  isDark,
  isPending,
  validationErrors,
}: WebAuthContentProps): React.JSX.Element => {
  const HPAD = 12;
  const primary = buttons?.primary;
  const secondary = buttons?.secondary;
  const links = buttons?.links;

  return (
    <>
      <View style={{ marginTop: 14, marginBottom: 10, paddingHorizontal: HPAD }}>
        <Header style={{}}>{headerText}</Header>
      </View>
      {body ? (
        typeof body === 'string' ? (
          <Text
            style={{
              paddingHorizontal: HPAD,
              color: isDark ? APP_COLORS.dark.text.body : APP_COLORS.light.text.body,
            }}
          >
            {body}
          </Text>
        ) : (
          body
        )
      ) : null}

      <FormFields
        fieldContainerStyle={{ paddingHorizontal: HPAD }}
        fieldErrorsContainer={{ paddingHorizontal: HPAD, paddingVertical: 6 }}
        fieldErrorStyle={{
          color: isDark ? APP_COLORS.dark.status.errorText : APP_COLORS.light.status.errorText,
          fontWeight: '700',
        }}
        fieldLabelStyle={{}}
        fieldStyle={{}}
        fields={fields}
        isPending={isPending}
        validationErrors={validationErrors}
        style={{ paddingBottom: 6 }}
      />

      {error ? (
        <View style={{ paddingHorizontal: HPAD, paddingBottom: 8 }}>
          <Text
            style={{
              color: isDark ? APP_COLORS.dark.status.errorText : APP_COLORS.light.status.errorText,
              fontWeight: '800',
            }}
          >
            {String(error)}
          </Text>
        </View>
      ) : null}

      {primary ? (
        <View style={{ paddingHorizontal: HPAD, marginTop: 12 }}>
          <AmplifyButton {...primary} variant="primary" style={{ width: '100%' }} />
        </View>
      ) : null}

      {secondary ? (
        <View style={{ paddingHorizontal: HPAD, marginTop: 8 }}>
          <AmplifyButton {...secondary} style={{ width: '100%' }} />
        </View>
      ) : null}

      {Array.isArray(links) && links.length ? (
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}
        >
          {links.map((b) => (
            <AmplifyButton
              key={String(b.children ?? 'link')}
              {...b}
              variant="link"
              style={{ minWidth: '50%', marginVertical: 4 }}
            />
          ))}
        </View>
      ) : null}

      <Footer style={{}} />
    </>
  );
};

const CustomSignIn = ({
  fields,
  handleBlur,
  handleChange,
  handleSubmit,
  hideSignUp,
  isPending,
  socialProviders,
  toFederatedSignIn,
  toForgotPassword,
  toSignUp,
  validationErrors,
  Footer,
  Header,
  FormFields,
  isDark,
  ...rest
}: Record<string, unknown> & {
  fields?: unknown;
  handleBlur?: (payload: { name: string; value: string }) => void;
  handleChange?: (payload: { name: string; value: string }) => void;
  handleSubmit?: (payload: Record<string, string>) => void;
  hideSignUp?: boolean;
  isPending?: boolean;
  socialProviders?: SocialProvidersProp;
  toFederatedSignIn?: ToFederatedSignInProp;
  toForgotPassword?: () => void;
  toSignUp?: () => void;
  validationErrors?: unknown;
  Footer: React.ComponentType<{ style?: unknown }>;
  Header: React.ComponentType<{ style?: unknown; children?: React.ReactNode }>;
  FormFields: React.ComponentType<AmplifyFormFieldsPropBag>;
  isDark: boolean;
}): React.JSX.Element => {
  const { getSignInTabText, getSignInText, getSignUpTabText, getForgotPasswordText } =
    authenticatorTextUtil;
  const headerText = getSignInTabText();
  const forgotPasswordText = getForgotPasswordText(true);
  const signInText = getSignInText();
  const signUpText = getSignUpTabText();

  const { disableFormSubmit, fieldsWithHandlers, fieldValidationErrors, handleFormSubmit } =
    useWebAuthFieldValues({
      componentName: 'SignIn',
      fields: Array.isArray(fields) ? fields : [],
      handleBlur,
      handleChange,
      handleSubmit,
      validationErrors,
    });

  const body =
    Platform.OS === 'web' && socialProviders && typeof toFederatedSignIn === 'function' ? (
      <FederatedProviderButtons
        route="signIn"
        socialProviders={socialProviders}
        toFederatedSignIn={toFederatedSignIn}
      />
    ) : null;

  const buttons = React.useMemo(() => {
    const forgotPassword = { children: forgotPasswordText, onPress: toForgotPassword };
    return {
      primary: {
        children: signInText,
        disabled: disableFormSubmit,
        onPress: () => handleFormSubmit(),
      },
      links: hideSignUp
        ? [forgotPassword]
        : [forgotPassword, { children: signUpText, onPress: toSignUp }],
    };
  }, [
    disableFormSubmit,
    forgotPasswordText,
    handleFormSubmit,
    hideSignUp,
    signInText,
    signUpText,
    toForgotPassword,
    toSignUp,
  ]);

  return Platform.OS === 'web' ? (
    <WebAuthContent
      {...rest}
      isDark={isDark}
      body={body}
      buttons={buttons}
      error={rest?.error}
      fields={fieldsWithHandlers}
      Footer={Footer}
      FormFields={FormFields}
      Header={Header}
      headerText={headerText}
      isPending={isPending}
      validationErrors={fieldValidationErrors}
    />
  ) : (
    // Native: pass through the full Authenticator-provided props.
    // If we omit Header/Footer/FormFields here, Amplify's DefaultContent will crash.
    <Authenticator.SignIn
      {...rest}
      fields={fields}
      handleBlur={handleBlur}
      handleChange={handleChange}
      handleSubmit={handleSubmit}
      hideSignUp={hideSignUp}
      isPending={isPending}
      socialProviders={socialProviders}
      toFederatedSignIn={toFederatedSignIn}
      toForgotPassword={toForgotPassword}
      toSignUp={toSignUp}
      validationErrors={validationErrors}
      Footer={Footer}
      Header={Header}
      FormFields={FormFields}
    />
  );
};

const CustomForgotPassword = ({
  fields,
  handleBlur,
  handleChange,
  handleSubmit,
  isPending,
  toSignIn,
  validationErrors,
  Footer,
  Header,
  FormFields,
  isDark,
  ...rest
}: Record<string, unknown> & {
  fields?: unknown;
  handleBlur?: (payload: { name: string; value: string }) => void;
  handleChange?: (payload: { name: string; value: string }) => void;
  handleSubmit?: (payload: Record<string, string>) => void;
  isPending?: boolean;
  toSignIn?: () => void;
  validationErrors?: unknown;
  Footer: React.ComponentType<{ style?: unknown }>;
  Header: React.ComponentType<{ style?: unknown; children?: React.ReactNode }>;
  FormFields: React.ComponentType<AmplifyFormFieldsPropBag>;
  isDark: boolean;
}): React.JSX.Element => {
  const { getResetYourPasswordText, getSendCodeText, getSendingText, getBackToSignInText } =
    authenticatorTextUtil;
  const headerText = getResetYourPasswordText();
  const primaryButtonText = isPending ? getSendingText() : getSendCodeText();
  const secondaryButtonText = getBackToSignInText();

  const { disableFormSubmit, fieldsWithHandlers, fieldValidationErrors, handleFormSubmit } =
    useWebAuthFieldValues({
      componentName: 'ForgotPassword',
      fields: Array.isArray(fields) ? fields : [],
      handleBlur,
      handleChange,
      handleSubmit,
      validationErrors,
    });

  const buttons = React.useMemo(
    () => ({
      primary: {
        children: primaryButtonText,
        disabled: disableFormSubmit,
        onPress: () => handleFormSubmit(),
      },
      links: [{ children: secondaryButtonText, onPress: toSignIn }],
    }),
    [disableFormSubmit, handleFormSubmit, primaryButtonText, secondaryButtonText, toSignIn],
  );

  return Platform.OS === 'web' ? (
    <WebAuthContent
      {...rest}
      isDark={isDark}
      buttons={buttons}
      error={rest?.error}
      fields={fieldsWithHandlers}
      Footer={Footer}
      FormFields={FormFields}
      Header={Header}
      headerText={headerText}
      isPending={isPending}
      validationErrors={fieldValidationErrors}
    />
  ) : (
    // Native: pass through the full Authenticator-provided props (incl. Header/Footer/FormFields).
    <Authenticator.ForgotPassword
      {...rest}
      fields={fields}
      handleBlur={handleBlur}
      handleChange={handleChange}
      handleSubmit={handleSubmit}
      isPending={isPending}
      toSignIn={toSignIn}
      validationErrors={validationErrors}
      Footer={Footer}
      Header={Header}
      FormFields={FormFields}
    />
  );
};

const CustomSignUp = ({
  fields,
  handleBlur,
  handleChange,
  handleSubmit,
  hasValidationErrors,
  hideSignIn,
  isPending,
  socialProviders,
  toFederatedSignIn,
  toSignIn,
  validationErrors,
  Footer,
  Header,
  FormFields,
  isDark,
  ...rest
}: Record<string, unknown> & {
  fields?: unknown;
  handleBlur?: (payload: { name: string; value: string }) => void;
  handleChange?: (payload: { name: string; value: string }) => void;
  handleSubmit?: (payload: Record<string, string>) => void;
  hasValidationErrors?: boolean;
  hideSignIn?: boolean;
  isPending?: boolean;
  socialProviders?: SocialProvidersProp;
  toFederatedSignIn?: ToFederatedSignInProp;
  toSignIn?: () => void;
  validationErrors?: unknown;
  Footer: React.ComponentType<{ style?: unknown }>;
  Header: React.ComponentType<{ style?: unknown; children?: React.ReactNode }>;
  FormFields: React.ComponentType<AmplifyFormFieldsPropBag>;
  isDark: boolean;
}): React.JSX.Element => {
  const { getCreateAccountText, getCreatingAccountText, getBackToSignInText, getSignUpTabText } =
    authenticatorTextUtil;

  const { disableFormSubmit, fieldsWithHandlers, fieldValidationErrors, handleFormSubmit } =
    useWebAuthFieldValues({
      componentName: 'SignUp',
      fields: Array.isArray(fields) ? fields : [],
      handleBlur,
      handleChange,
      handleSubmit,
      validationErrors,
    });

  const disabled = hasValidationErrors || disableFormSubmit;
  const headerText = getSignUpTabText();
  const primaryButtonText = isPending ? getCreatingAccountText() : getCreateAccountText();
  const secondaryButtonText = getBackToSignInText();

  const body =
    Platform.OS === 'web' && socialProviders && typeof toFederatedSignIn === 'function' ? (
      <FederatedProviderButtons
        route="signUp"
        socialProviders={socialProviders}
        toFederatedSignIn={toFederatedSignIn}
      />
    ) : null;

  const buttons = React.useMemo(
    () => ({
      primary: { children: primaryButtonText, disabled, onPress: () => handleFormSubmit() },
      links: hideSignIn ? undefined : [{ children: secondaryButtonText, onPress: toSignIn }],
    }),
    [disabled, handleFormSubmit, hideSignIn, primaryButtonText, secondaryButtonText, toSignIn],
  );

  return Platform.OS === 'web' ? (
    // Web warning fix: browsers expect password inputs inside a <form>.
    // Also allows "Enter" to submit.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) handleFormSubmit();
      }}
      style={{ width: '100%' }}
    >
      <WebAuthContent
        body={body}
        buttons={buttons}
        error={rest?.error}
        fields={fieldsWithHandlers}
        Footer={Footer}
        FormFields={FormFields}
        Header={Header}
        headerText={headerText}
        isPending={isPending}
        validationErrors={fieldValidationErrors}
        isDark={!!isDark}
      />
    </form>
  ) : (
    // Native: use Amplify's built-in screen (DefaultContent is a web-oriented helper and can break on RN).
    // But override the "Sign In" link label to match our desired wording.
    <View>
      <Authenticator.SignUp
        {...rest}
        fields={fields}
        handleBlur={handleBlur}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        hasValidationErrors={hasValidationErrors}
        // Hide Amplify's built-in "Sign In" link so we can render our own wording below.
        hideSignIn
        isPending={isPending}
        socialProviders={socialProviders}
        toFederatedSignIn={toFederatedSignIn}
        toSignIn={toSignIn}
        validationErrors={validationErrors}
        Footer={Footer}
        Header={Header}
        FormFields={FormFields}
      />
      {!hideSignIn && typeof toSignIn === 'function' ? (
        <AmplifyButton
          onPress={() => toSignIn()}
          variant="link"
          style={styles.authBackLinkBtn}
          accessibilityLabel="Back to Sign In"
        >
          {secondaryButtonText}
        </AmplifyButton>
      ) : null}
    </View>
  );
};

const ConfirmResetPasswordWithBackToSignIn = ({
  isDark: _isDark,
  ...props
}: React.ComponentProps<typeof Authenticator.ConfirmResetPassword> & {
  isDark: boolean;
}): React.JSX.Element => {
  const { toSignIn } = useAuthenticator();
  return (
    <View>
      <Authenticator.ConfirmResetPassword {...props} />
      <AmplifyButton
        onPress={() => toSignIn()}
        variant="link"
        style={styles.authBackLinkBtn}
        accessibilityLabel="Back to Sign In"
      >
        Back to Sign In
      </AmplifyButton>
    </View>
  );
};

const WebForm = ({ children }: { children: React.ReactNode }): React.JSX.Element =>
  Platform.OS === 'web' ? (
    // Web warning fix: browsers expect password inputs inside a <form>.
    // We prevent default submit behavior to avoid full-page reloads.
    <form
      onSubmit={(e) => {
        e.preventDefault();
      }}
      style={{ width: '100%' }}
    >
      {children}
    </form>
  ) : (
    <>{children}</>
  );

export function useAmplifyAuthenticatorConfig(isDark: boolean): {
  amplifyTheme: React.ComponentProps<typeof ThemeProvider>['theme'];
  authComponents: React.ComponentProps<typeof Authenticator>['components'];
} {
  const amplifyTheme = React.useMemo(
    () => ({
      // Light defaults (match app)
      tokens: {
        colors: {
          background: {
            primary: APP_COLORS.light.bg.app,
            secondary: APP_COLORS.light.bg.surface2,
            tertiary: APP_COLORS.light.bg.app,
          },
          border: {
            primary: APP_COLORS.light.border.subtle,
            secondary: PALETTE.lineMedium,
          },
          font: {
            primary: APP_COLORS.light.text.primary,
            secondary: APP_COLORS.light.text.body,
            tertiary: APP_COLORS.light.text.muted,
            interactive: APP_COLORS.light.text.primary,
            error: APP_COLORS.light.status.errorText,
          },
          // Kill the teal/blue brand colors for this app; keep it neutral.
          primary: {
            10: APP_COLORS.light.bg.surface2,
            20: APP_COLORS.light.border.subtle,
            40: PALETTE.slate175,
            60: PALETTE.slate380,
            80: PALETTE.slate750,
            90: APP_COLORS.light.text.primary,
            100: PALETTE.black,
          },
        },
      },
      // Dark mode override tokens to ensure the authenticator background never goes "bluish".
      overrides: [
        {
          colorMode: 'dark' as const,
          tokens: {
            colors: {
              background: {
                primary: APP_COLORS.dark.bg.surface,
                secondary: APP_COLORS.dark.bg.header,
                tertiary: APP_COLORS.dark.bg.surface,
                // Used by the `ErrorMessage` primitive container.
                error: PALETTE.dangerBgDarkAlt,
              },
              border: {
                primary: APP_COLORS.dark.border.default,
                secondary: APP_COLORS.dark.border.default,
              },
              font: {
                primary: APP_COLORS.dark.text.primary,
                secondary: APP_COLORS.dark.text.body,
                tertiary: APP_COLORS.dark.text.muted,
                interactive: APP_COLORS.dark.text.primary,
                // Validation errors ("Please enter a valid email", etc).
                // This is the main fix for readability on dark backgrounds.
                error: APP_COLORS.dark.status.errorText,
              },
              primary: {
                10: PALETTE.slate750,
                20: PALETTE.slate750,
                40: PALETTE.slate650,
                60: PALETTE.slate500,
                80: APP_COLORS.dark.text.body,
                90: APP_COLORS.dark.text.primary,
                100: APP_COLORS.dark.text.primary,
              },
            },
          },
        },
      ],
      components: {
        button: () => ({
          container: {
            borderRadius: 12,
            // Avoid text clipping on Android devices (varies with font scale / OEM fonts).
            minHeight: 44,
            paddingVertical: 12,
            paddingHorizontal: 12,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
          },
          containerPrimary: {
            backgroundColor: isDark ? PALETTE.slate750 : APP_COLORS.light.text.primary,
            borderWidth: 0,
            ...(Platform.OS === 'web' ? ({ alignSelf: 'stretch' } as const) : null),
          },
          // Some Authenticator flows on web use the "variation" style keys directly.
          // Provide an explicit primary variant override so buttons never fall back to Amplify teal.
          primary: {
            backgroundColor: isDark ? PALETTE.slate750 : APP_COLORS.light.text.primary,
            borderWidth: 0,
            ...(Platform.OS === 'web' ? ({ alignSelf: 'stretch' } as const) : null),
          },
          primaryPressed: { opacity: 0.9 },
          containerDefault: {
            // Use a soft off-white fill in light mode (matches our text field backgrounds).
            backgroundColor: isDark ? APP_COLORS.dark.bg.header : APP_COLORS.light.bg.surface2,
            borderWidth: 1,
            borderColor: isDark ? APP_COLORS.dark.border.default : APP_COLORS.light.border.subtle,
            ...(Platform.OS === 'web' ? ({ alignSelf: 'stretch' } as const) : null),
          },
          pressed: { opacity: 0.9 },
          // Give descenders (e.g. "g") enough vertical room across devices.
          text: { fontWeight: '800' as const, fontSize: 15, lineHeight: 20 },
          textPrimary: { color: APP_COLORS.dark.text.primary },
          textDefault: {
            color: isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary,
          },
          containerLink: { backgroundColor: 'transparent' },
          textLink: {
            color: isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary,
            fontWeight: '800' as const,
            fontSize: 15,
            lineHeight: 20,
          },
        }),
        textField: () => ({
          label: {
            color: isDark ? APP_COLORS.dark.text.body : APP_COLORS.light.text.body,
            fontWeight: '700' as const,
          },
          // Ensure full-width fields on web (Authenticator container doesn't force stretch).
          container:
            Platform.OS === 'web' ? ({ width: '100%', alignSelf: 'stretch' } as const) : undefined,
          fieldContainer: {
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isDark ? APP_COLORS.dark.border.default : APP_COLORS.light.border.subtle,
            // Off-gray fill in light mode (avoid stark white inputs).
            backgroundColor: isDark ? APP_COLORS.dark.bg.header : APP_COLORS.light.bg.surface2,
            ...(Platform.OS === 'web' ? ({ height: 48 } as const) : null),
            // Let the actual input fill the container so the browser focus ring
            // matches the rounded shape (no "square inside the bubble").
            paddingHorizontal: 0,
            ...(Platform.OS === 'web' ? ({ width: '100%', alignSelf: 'stretch' } as const) : null),
          },
          field: {
            color: isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary,
            paddingVertical: Platform.OS === 'web' ? 0 : 12,
            paddingHorizontal: 12,
            borderRadius: 12,
            ...(Platform.OS === 'web'
              ? ({
                  height: 48,
                  fontSize: 16,
                  lineHeight: 20,
                  textAlignVertical: 'center' as const,
                } as const)
              : null),
            ...(Platform.OS === 'web'
              ? ({
                  width: '100%',
                  alignSelf: 'stretch',
                } as const)
              : null),
          },
        }),
        errorMessage: () => ({
          label: {
            // Higher-contrast error color for dark backgrounds.
            color: isDark ? APP_COLORS.dark.status.errorText : APP_COLORS.light.status.errorText,
            fontWeight: '700' as const,
          },
        }),
      },
    }),
    [isDark],
  );

  const caretProps = React.useMemo(
    () => ({
      selectionColor: isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary,
      cursorColor: isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary,
    }),
    [isDark],
  );

  const confirmResetFormFields = React.useCallback(
    (ffProps: AmplifyFormFieldsPropBag) => (
      <LinkedConfirmResetPasswordFormFields {...ffProps} isDark={isDark} caret={caretProps} />
    ),
    [isDark, caretProps],
  );

  const signInFormFields = React.useCallback(
    (ffProps: AmplifyFormFieldsPropBag) => (
      <LinkedSignInFormFields {...ffProps} isDark={isDark} caret={caretProps} />
    ),
    [isDark, caretProps],
  );

  const signUpFormFields = React.useCallback(
    (ffProps: AmplifyFormFieldsPropBag) => (
      <LinkedSignUpFormFields {...ffProps} isDark={isDark} caret={caretProps} />
    ),
    [isDark, caretProps],
  );

  const authComponents = React.useMemo(
    () => ({
      SignIn: (props: unknown) => {
        const p = (typeof props === 'object' && props != null ? props : {}) as React.ComponentProps<
          typeof Authenticator.SignIn
        >;
        return (
          <WebForm>
            <CustomSignIn
              isDark={isDark}
              {...p}
              fields={injectCaretColors(p.fields, caretProps)}
              FormFields={signInFormFields}
            />
          </WebForm>
        );
      },
      SignUp: (props: unknown) => {
        const p = (typeof props === 'object' && props != null ? props : {}) as React.ComponentProps<
          typeof Authenticator.SignUp
        >;
        return (
          <CustomSignUp
            isDark={isDark}
            {...p}
            fields={injectCaretColors(p.fields, caretProps)}
            FormFields={signUpFormFields}
          />
        );
      },
      ForgotPassword: (props: unknown) => {
        const p = (typeof props === 'object' && props != null ? props : {}) as React.ComponentProps<
          typeof Authenticator.ForgotPassword
        >;
        return (
          <WebForm>
            <CustomForgotPassword
              isDark={isDark}
              {...p}
              fields={injectCaretColors(p.fields, caretProps)}
            />
          </WebForm>
        );
      },
      ConfirmResetPassword: (props: unknown) => {
        const p =
          typeof props === 'object' && props != null ? (props as Record<string, unknown>) : {};
        return (
          <WebForm>
            <ConfirmResetPasswordWithBackToSignIn
              {...(p as React.ComponentProps<typeof Authenticator.ConfirmResetPassword>)}
              isDark={isDark}
              fields={injectCaretColors(p.fields, caretProps)}
              FormFields={confirmResetFormFields}
            />
          </WebForm>
        );
      },
      ConfirmSignUp: (props: unknown) => {
        const p =
          typeof props === 'object' && props != null ? (props as Record<string, unknown>) : {};
        return (
          <WebForm>
            <Authenticator.ConfirmSignUp
              {...(p as React.ComponentProps<typeof Authenticator.ConfirmSignUp>)}
              fields={injectCaretColors(p.fields, caretProps)}
            />
          </WebForm>
        );
      },
      ConfirmSignIn: (props: unknown) => {
        const p =
          typeof props === 'object' && props != null ? (props as Record<string, unknown>) : {};
        return (
          <WebForm>
            <Authenticator.ConfirmSignIn
              {...(p as React.ComponentProps<typeof Authenticator.ConfirmSignIn>)}
              fields={injectCaretColors(p.fields, caretProps)}
            />
          </WebForm>
        );
      },
    }),
    [caretProps, confirmResetFormFields, isDark, signInFormFields, signUpFormFields],
  );

  return { amplifyTheme, authComponents };
}
