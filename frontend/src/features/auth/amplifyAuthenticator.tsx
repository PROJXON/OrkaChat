import React from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Image, Platform, Pressable, Text, TextInput, View } from 'react-native';
import {
  Authenticator,
  ThemeProvider,
  useAuthenticator,
} from '@aws-amplify/ui-react-native/dist';
import { icons } from '@aws-amplify/ui-react-native/dist/assets';
import { Button as AmplifyButton, PhoneNumberField, TextField } from '@aws-amplify/ui-react-native/dist/primitives';
import { authenticatorTextUtil, getErrors } from '@aws-amplify/ui';
import { FederatedProviderButtons } from '@aws-amplify/ui-react-native/dist/Authenticator/common';
import { styles } from '../../../App.styles';

type CaretColors = { selectionColor: string; cursorColor?: string };

type AmplifyFieldLike = Record<string, unknown> & {
  name?: unknown;
  type?: unknown;
  required?: unknown;
  value?: unknown;
  labelHidden?: unknown;
  label?: unknown;
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

// iOS workaround: multiple secureTextEntry inputs can glitch unless we insert a hidden TextInput
// after each secure input.
const HIDDEN_INPUT_PROPS = {
  accessibilityElementsHidden: true,
  style: { backgroundColor: 'transparent', height: 0.1, width: 0.1, pointerEvents: 'none' as const },
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
  const webFullWidth = Platform.OS === 'web' ? ({ width: '100%', alignSelf: 'stretch' } as const) : null;
  const webFieldFullWidthObj =
    Platform.OS === 'web' ? ({ width: '100%', alignSelf: 'stretch', flexGrow: 1, flexShrink: 1, minWidth: 0 } as const) : null;

  const validationRec =
    typeof validationErrors === 'object' && validationErrors != null ? (validationErrors as Record<string, unknown>) : {};

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
      rawValue == null || typeof rawValue === 'string'
        ? { value: rawValue ?? '' }
        : null;

    const endAccessory = isPassword ? (
      // Web warning fix: Amplify's Icon uses `style.resizeMode` + `style.tintColor` (deprecated on RN-web).
      // Use our own Image with `resizeMode`/`tintColor` props instead.
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
        disabled={isPending}
        onPress={() => setShowPassword((v) => !v)}
        style={({ pressed }) => [{ padding: 8, opacity: pressed ? 0.8 : 1 }, isPending ? { opacity: 0.5 } : null]}
      >
        <Image
          source={showPassword ? icons.visibilityOn : icons.visibilityOff}
          resizeMode="contain"
          tintColor={isDark ? '#d7d7e0' : '#666'}
          style={{ width: 18, height: 18 }}
        />
      </Pressable>
    ) : undefined;

    return (
      <React.Fragment key={name}>
        <FieldComp
          {...(field as React.ComponentProps<typeof TextField>)}
          {...(valueProp || {})}
          disabled={isPending}
          error={hasError}
          // On web, Amplify's TextField doesn't always merge style arrays for the underlying <input>.
          // Provide a single merged object to ensure full-width inputs.
          fieldStyle={Platform.OS === 'web' ? { ...(fieldStyle || {}), ...(webFieldFullWidthObj || {}) } : fieldStyle}
          style={[fieldContainerStyle, webFullWidth]}
          selectionColor={caret.selectionColor}
          cursorColor={caret.cursorColor}
          secureTextEntry={isPassword ? !showPassword : undefined}
          endAccessory={endAccessory}
        />
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
  const MAX_USERNAME_LEN = 21;
  const webFullWidth = Platform.OS === 'web' ? ({ width: '100%', alignSelf: 'stretch' } as const) : null;
  const webFieldFullWidthObj =
    Platform.OS === 'web' ? ({ width: '100%', alignSelf: 'stretch', flexGrow: 1, flexShrink: 1, minWidth: 0 } as const) : null;

  const validationRec =
    typeof validationErrors === 'object' && validationErrors != null ? (validationErrors as Record<string, unknown>) : {};

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
      rawValue == null || typeof rawValue === 'string'
        ? { value: rawValue ?? '' }
        : null;

    const endAccessory = isPassword ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
        disabled={isPending}
        onPress={() => setShowPassword((v) => !v)}
        style={({ pressed }) => [{ padding: 8, opacity: pressed ? 0.8 : 1 }, isPending ? { opacity: 0.5 } : null]}
      >
        <Image
          source={showPassword ? icons.visibilityOn : icons.visibilityOff}
          resizeMode="contain"
          tintColor={isDark ? '#d7d7e0' : '#666'}
          style={{ width: 18, height: 18 }}
        />
      </Pressable>
    ) : undefined;

    return (
      <React.Fragment key={name}>
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
          fieldStyle={Platform.OS === 'web' ? { ...(fieldStyle || {}), ...(webFieldFullWidthObj || {}) } : fieldStyle}
          style={[fieldContainerStyle, webFullWidth]}
          selectionColor={caret.selectionColor}
          cursorColor={caret.cursorColor}
          secureTextEntry={isPassword ? !showPassword : undefined}
          endAccessory={endAccessory}
        />
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
  const webFullWidth = Platform.OS === 'web' ? ({ width: '100%', alignSelf: 'stretch' } as const) : null;
  const webFieldFullWidthObj =
    Platform.OS === 'web' ? ({ width: '100%', alignSelf: 'stretch', flexGrow: 1, flexShrink: 1, minWidth: 0 } as const) : null;

  const validationRec =
    typeof validationErrors === 'object' && validationErrors != null ? (validationErrors as Record<string, unknown>) : {};

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
      rawValue == null || typeof rawValue === 'string'
        ? { value: rawValue ?? '' }
        : null;

    const endAccessory = isPassword ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
        disabled={isPending}
        onPress={() => setShowPassword((v) => !v)}
        style={({ pressed }) => [{ padding: 8, opacity: pressed ? 0.8 : 1 }, isPending ? { opacity: 0.5 } : null]}
      >
        <Image
          // Reflect current state: "eye open" means visible.
          source={showPassword ? icons.visibilityOn : icons.visibilityOff}
          resizeMode="contain"
          tintColor={isDark ? '#d7d7e0' : '#666'}
          style={{ width: 18, height: 18 }}
        />
      </Pressable>
    ) : undefined;

    return (
      <React.Fragment key={name}>
        <FieldComp
          {...(field as React.ComponentProps<typeof TextField>)}
          {...(valueProp || {})}
          disabled={isPending}
          error={hasError}
          fieldStyle={Platform.OS === 'web' ? { ...(fieldStyle || {}), ...(webFieldFullWidthObj || {}) } : fieldStyle}
          style={[fieldContainerStyle, webFullWidth]}
          selectionColor={caret.selectionColor}
          cursorColor={caret.cursorColor}
          secureTextEntry={isPassword ? !showPassword : undefined}
          endAccessory={endAccessory}
        />
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
      const rec: AmplifyFieldLike = typeof field === 'object' && field != null ? (field as AmplifyFieldLike) : {};
      const name = String(rec.name ?? '');
      if (!name) return rec;

      const reportChange = (valueRaw: unknown) => {
        const value = toStr(valueRaw);
        handleChange?.({ name, value });
        setValues((prev) => ({ ...prev, [name]: value }));
      };

      const onBlur = (event: unknown) => {
        const evRec = typeof event === 'object' && event != null ? (event as Record<string, unknown>) : {};
        const nativeEvent =
          typeof evRec.nativeEvent === 'object' && evRec.nativeEvent != null ? (evRec.nativeEvent as Record<string, unknown>) : {};
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
        const evRec = typeof event === 'object' && event != null ? (event as Record<string, unknown>) : {};
        const nativeEvent =
          typeof evRec.nativeEvent === 'object' && evRec.nativeEvent != null ? (evRec.nativeEvent as Record<string, unknown>) : {};
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
      <Header style={{ marginVertical: 10, paddingHorizontal: HPAD }}>{headerText}</Header>
      {body ? typeof body === 'string' ? <Text style={{ paddingHorizontal: HPAD, color: isDark ? '#d7d7e0' : '#444' }}>{body}</Text> : body : null}

      <FormFields
        fieldContainerStyle={{ paddingHorizontal: HPAD }}
        fieldErrorsContainer={{ paddingHorizontal: HPAD, paddingVertical: 6 }}
        fieldErrorStyle={{ color: isDark ? '#ff6b6b' : '#b00020', fontWeight: '700' }}
        fieldLabelStyle={{}}
        fieldStyle={{}}
        fields={fields}
        isPending={isPending}
        validationErrors={validationErrors}
        style={{ paddingBottom: 6 }}
      />

      {error ? (
        <View style={{ paddingHorizontal: HPAD, paddingBottom: 8 }}>
          <Text style={{ color: isDark ? '#ff6b6b' : '#b00020', fontWeight: '800' }}>{String(error)}</Text>
        </View>
      ) : null}

      {primary ? (
        <View style={{ paddingHorizontal: HPAD }}>
          <AmplifyButton {...primary} variant="primary" style={{ width: '100%' }} />
        </View>
      ) : null}

      {secondary ? (
        <View style={{ paddingHorizontal: HPAD, marginTop: 8 }}>
          <AmplifyButton {...secondary} style={{ width: '100%' }} />
        </View>
      ) : null}

      {Array.isArray(links) && links.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
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
  const { getSignInTabText, getSignInText, getSignUpTabText, getForgotPasswordText } = authenticatorTextUtil;
  const headerText = getSignInTabText();
  const forgotPasswordText = getForgotPasswordText(true);
  const signInText = getSignInText();
  const signUpText = getSignUpTabText();

  const { disableFormSubmit, fieldsWithHandlers, fieldValidationErrors, handleFormSubmit } = useWebAuthFieldValues({
    componentName: 'SignIn',
    fields: Array.isArray(fields) ? fields : [],
    handleBlur,
    handleChange,
    handleSubmit,
    validationErrors,
  });

  const body =
    Platform.OS === 'web' && socialProviders && typeof toFederatedSignIn === 'function' ? (
      <FederatedProviderButtons route="signIn" socialProviders={socialProviders} toFederatedSignIn={toFederatedSignIn} />
    ) : null;

  const buttons = React.useMemo(() => {
    const forgotPassword = { children: forgotPasswordText, onPress: toForgotPassword };
    return {
      primary: { children: signInText, disabled: disableFormSubmit, onPress: () => handleFormSubmit() },
      links: hideSignUp ? [forgotPassword] : [forgotPassword, { children: signUpText, onPress: toSignUp }],
    };
  }, [disableFormSubmit, forgotPasswordText, handleFormSubmit, hideSignUp, signInText, signUpText, toForgotPassword, toSignUp]);

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
  const { getResetYourPasswordText, getSendCodeText, getSendingText, getBackToSignInText } = authenticatorTextUtil;
  const headerText = getResetYourPasswordText();
  const primaryButtonText = isPending ? getSendingText() : getSendCodeText();
  const secondaryButtonText = getBackToSignInText();

  const { disableFormSubmit, fieldsWithHandlers, fieldValidationErrors, handleFormSubmit } = useWebAuthFieldValues({
    componentName: 'ForgotPassword',
    fields: Array.isArray(fields) ? fields : [],
    handleBlur,
    handleChange,
    handleSubmit,
    validationErrors,
  });

  const buttons = React.useMemo(
    () => ({
      primary: { children: primaryButtonText, disabled: disableFormSubmit, onPress: () => handleFormSubmit() },
      links: [{ children: secondaryButtonText, onPress: toSignIn }],
    }),
    [disableFormSubmit, handleFormSubmit, primaryButtonText, secondaryButtonText, toSignIn]
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
  const { getCreateAccountText, getCreatingAccountText, getBackToSignInText, getSignUpTabText } = authenticatorTextUtil;

  const { disableFormSubmit, fieldsWithHandlers, fieldValidationErrors, handleFormSubmit } = useWebAuthFieldValues({
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
      <FederatedProviderButtons route="signUp" socialProviders={socialProviders} toFederatedSignIn={toFederatedSignIn} />
    ) : null;

  const buttons = React.useMemo(
    () => ({
      primary: { children: primaryButtonText, disabled, onPress: () => handleFormSubmit() },
      links: hideSignIn ? undefined : [{ children: secondaryButtonText, onPress: toSignIn }],
    }),
    [disabled, handleFormSubmit, hideSignIn, primaryButtonText, secondaryButtonText, toSignIn]
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
    <Authenticator.SignUp
      {...rest}
      fields={fields}
      handleBlur={handleBlur}
      handleChange={handleChange}
      handleSubmit={handleSubmit}
      hasValidationErrors={hasValidationErrors}
      hideSignIn={hideSignIn}
      isPending={isPending}
      socialProviders={socialProviders}
      toFederatedSignIn={toFederatedSignIn}
      toSignIn={toSignIn}
      validationErrors={validationErrors}
      Footer={Footer}
      Header={Header}
      FormFields={FormFields}
    />
  );
};

const ConfirmResetPasswordWithBackToSignIn = ({
  isDark: _isDark,
  ...props
}: React.ComponentProps<typeof Authenticator.ConfirmResetPassword> & { isDark: boolean }): React.JSX.Element => {
  const { toSignIn } = useAuthenticator();
  return (
    <View>
      <Authenticator.ConfirmResetPassword {...props} />
      <AmplifyButton onPress={() => toSignIn()} variant="link" style={styles.authBackLinkBtn} accessibilityLabel="Back to Sign In">
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
            primary: '#ffffff',
            secondary: '#f2f2f7',
            tertiary: '#ffffff',
          },
          border: {
            primary: '#e3e3e3',
            secondary: '#ddd',
          },
          font: {
            primary: '#111',
            secondary: '#444',
            tertiary: '#666',
            interactive: '#111',
            error: '#b00020',
          },
          // Kill the teal/blue brand colors for this app; keep it neutral.
          primary: {
            10: '#f2f2f7',
            20: '#e3e3e3',
            40: '#c7c7cc',
            60: '#8e8e93',
            80: '#2a2a33',
            90: '#111',
            100: '#000',
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
                primary: '#14141a',
                secondary: '#1c1c22',
                tertiary: '#14141a',
                // Used by the `ErrorMessage` primitive container.
                error: '#2a1a1a',
              },
              border: {
                primary: '#2a2a33',
                secondary: '#2a2a33',
              },
              font: {
                primary: '#ffffff',
                secondary: '#d7d7e0',
                tertiary: '#a7a7b4',
                interactive: '#ffffff',
                // Validation errors ("Please enter a valid email", etc).
                // This is the main fix for readability on dark backgrounds.
                error: '#ff6b6b',
              },
              primary: {
                10: '#2a2a33',
                20: '#2a2a33',
                40: '#444',
                60: '#666',
                80: '#d7d7e0',
                90: '#ffffff',
                100: '#ffffff',
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
            backgroundColor: isDark ? '#2a2a33' : '#111',
            borderWidth: 0,
            ...(Platform.OS === 'web' ? ({ alignSelf: 'stretch' } as const) : null),
          },
          // Some Authenticator flows on web use the "variation" style keys directly.
          // Provide an explicit primary variant override so buttons never fall back to Amplify teal.
          primary: {
            backgroundColor: isDark ? '#2a2a33' : '#111',
            borderWidth: 0,
            ...(Platform.OS === 'web' ? ({ alignSelf: 'stretch' } as const) : null),
          },
          primaryPressed: { opacity: 0.9 },
          containerDefault: {
            // Use a soft off-white fill in light mode (matches our text field backgrounds).
            backgroundColor: isDark ? '#1c1c22' : '#f2f2f7',
            borderWidth: 1,
            borderColor: isDark ? '#2a2a33' : '#e3e3e3',
            ...(Platform.OS === 'web' ? ({ alignSelf: 'stretch' } as const) : null),
          },
          pressed: { opacity: 0.9 },
          // Give descenders (e.g. "g") enough vertical room across devices.
          text: { fontWeight: '800' as const, fontSize: 15, lineHeight: 20 },
          textPrimary: { color: '#fff' },
          textDefault: { color: isDark ? '#fff' : '#111' },
          containerLink: { backgroundColor: 'transparent' },
          textLink: {
            color: isDark ? '#fff' : '#111',
            fontWeight: '800' as const,
            fontSize: 15,
            lineHeight: 20,
          },
        }),
        textField: () => ({
          label: { color: isDark ? '#d7d7e0' : '#444', fontWeight: '700' as const },
          // Ensure full-width fields on web (Authenticator container doesn't force stretch).
          container: Platform.OS === 'web' ? ({ width: '100%', alignSelf: 'stretch' } as const) : undefined,
          fieldContainer: {
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isDark ? '#2a2a33' : '#e3e3e3',
            // Off-gray fill in light mode (avoid stark white inputs).
            backgroundColor: isDark ? '#1c1c22' : '#f2f2f7',
            paddingHorizontal: 8,
            ...(Platform.OS === 'web' ? ({ width: '100%', alignSelf: 'stretch' } as const) : null),
          },
          field: {
            color: isDark ? '#fff' : '#111',
            paddingVertical: 12,
            ...(Platform.OS === 'web' ? ({ width: '100%' } as const) : null),
          },
        }),
        errorMessage: () => ({
          label: {
            // Higher-contrast error color for dark backgrounds.
            color: isDark ? '#ff6b6b' : '#b00020',
            fontWeight: '700' as const,
          },
        }),
      },
    }),
    [isDark]
  );

  const caretProps = React.useMemo(
    () => ({
      selectionColor: isDark ? '#ffffff' : '#111',
      cursorColor: isDark ? '#ffffff' : '#111',
    }),
    [isDark]
  );

  const confirmResetFormFields = React.useCallback(
    (ffProps: AmplifyFormFieldsPropBag) => <LinkedConfirmResetPasswordFormFields {...ffProps} isDark={isDark} caret={caretProps} />,
    [isDark, caretProps]
  );

  const signInFormFields = React.useCallback(
    (ffProps: AmplifyFormFieldsPropBag) => <LinkedSignInFormFields {...ffProps} isDark={isDark} caret={caretProps} />,
    [isDark, caretProps]
  );

  const signUpFormFields = React.useCallback(
    (ffProps: AmplifyFormFieldsPropBag) => <LinkedSignUpFormFields {...ffProps} isDark={isDark} caret={caretProps} />,
    [isDark, caretProps]
  );

  const authComponents = React.useMemo(
    () => ({
      SignIn: (props: unknown) => {
        const p = (typeof props === 'object' && props != null ? props : {}) as React.ComponentProps<typeof Authenticator.SignIn>;
        return (
          <WebForm>
            <CustomSignIn isDark={isDark} {...p} fields={injectCaretColors(p.fields, caretProps)} FormFields={signInFormFields} />
          </WebForm>
        );
      },
      SignUp: (props: unknown) => {
        const p = (typeof props === 'object' && props != null ? props : {}) as React.ComponentProps<typeof Authenticator.SignUp>;
        return <CustomSignUp isDark={isDark} {...p} fields={injectCaretColors(p.fields, caretProps)} FormFields={signUpFormFields} />;
      },
      ForgotPassword: (props: unknown) => {
        const p = (typeof props === 'object' && props != null ? props : {}) as React.ComponentProps<typeof Authenticator.ForgotPassword>;
        return (
          <WebForm>
            <CustomForgotPassword isDark={isDark} {...p} fields={injectCaretColors(p.fields, caretProps)} />
          </WebForm>
        );
      },
      ConfirmResetPassword: (props: unknown) => {
        const p = typeof props === 'object' && props != null ? (props as Record<string, unknown>) : {};
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
        const p = typeof props === 'object' && props != null ? (props as Record<string, unknown>) : {};
        return (
          <WebForm>
            <Authenticator.ConfirmSignUp {...(p as React.ComponentProps<typeof Authenticator.ConfirmSignUp>)} fields={injectCaretColors(p.fields, caretProps)} />
          </WebForm>
        );
      },
      ConfirmSignIn: (props: unknown) => {
        const p = typeof props === 'object' && props != null ? (props as Record<string, unknown>) : {};
        return (
          <WebForm>
            <Authenticator.ConfirmSignIn {...(p as React.ComponentProps<typeof Authenticator.ConfirmSignIn>)} fields={injectCaretColors(p.fields, caretProps)} />
          </WebForm>
        );
      },
    }),
    [caretProps, confirmResetFormFields, isDark, signInFormFields, signUpFormFields]
  );

  return { amplifyTheme, authComponents };
}

