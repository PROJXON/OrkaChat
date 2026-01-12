import * as React from 'react';
import { Animated, Easing, Platform, Text, View } from 'react-native';

import { styles } from '../../../screens/ChatScreen.styles';

export function TypingIndicator({
  text,
  color,
}: {
  text: string;
  color: string;
}): React.JSX.Element {
  const dot1 = React.useRef(new Animated.Value(0)).current;
  const dot2 = React.useRef(new Animated.Value(0)).current;
  const dot3 = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const makeDotAnim = (v: Animated.Value) =>
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 260,
          easing: Easing.in(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.stagger(130, [makeDotAnim(dot1), makeDotAnim(dot2), makeDotAnim(dot3)]),
        Animated.delay(450),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dot1, dot2, dot3]);

  const dotStyle = (v: Animated.Value) => ({
    transform: [
      {
        translateY: v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -5],
        }),
      },
    ],
    opacity: v.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    }),
  });

  return (
    <View style={styles.typingIndicatorRow}>
      <Text style={[styles.typingText, { color }]}>{text}</Text>
      <View style={styles.typingDotsRow} accessibilityLabel={`${text}...`}>
        <Animated.Text style={[styles.typingDot, { color }, dotStyle(dot1)]}>.</Animated.Text>
        <Animated.Text style={[styles.typingDot, { color }, dotStyle(dot2)]}>.</Animated.Text>
        <Animated.Text style={[styles.typingDot, { color }, dotStyle(dot3)]}>.</Animated.Text>
      </View>
    </View>
  );
}
