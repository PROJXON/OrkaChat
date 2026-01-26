import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Image, StyleSheet } from 'react-native';

import { AppBrandIcon } from '../AppBrandIcon';

function getImage(screen: ReturnType<typeof render>) {
  return screen.UNSAFE_getByType(Image);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AppBrandIcon', () => {
  test('defaults to accessible, clipped, rounded slot with label', () => {
    const screen = render(<AppBrandIcon isDark={false} />);

    const slot = screen.getByLabelText('App icon');
    const slotStyle = StyleSheet.flatten(slot.props.style);

    expect(slot.props.accessible).toBe(true);
    expect(slot.props.accessibilityLabel).toBe('App icon');

    // Defaults: clipped + rounded
    expect(slotStyle.overflow).toBe('hidden');
    expect(slotStyle.borderRadius).toBe(999);
  });

  test('fit="crop" uses resizeMode="cover" and zoom/zoomLight/zoomDark rules', () => {
    const screenLight = render(<AppBrandIcon isDark={false} fit="crop" />);
    const imgLight = getImage(screenLight);
    const imgLightStyle = StyleSheet.flatten(imgLight.props.style);

    expect(imgLight.props.resizeMode).toBe('cover');
    expect(imgLightStyle.transform?.[0]?.scale).toBeCloseTo(2.15, 5);

    const screenDark = render(<AppBrandIcon isDark fit="crop" />);
    const imgDark = getImage(screenDark);
    const imgDarkStyle = StyleSheet.flatten(imgDark.props.style);

    expect(imgDark.props.resizeMode).toBe('cover');
    expect(imgDarkStyle.transform?.[0]?.scale).toBeCloseTo(2.45, 5);

    // The require(...) sources should differ between light/dark
    expect(imgLight.props.source).not.toEqual(imgDark.props.source);

    // Explicit zoom overrides the defaults
    const screenOverride = render(<AppBrandIcon isDark fit="crop" zoom={3} />);
    const imgOverride = getImage(screenOverride);
    const imgOverrideStyle = StyleSheet.flatten(imgOverride.props.style);

    expect(imgOverrideStyle.transform?.[0]?.scale).toBe(3);
  });

  test('fit="contain" uses resizeMode="contain" and containZoom rules', () => {
    const screenLight = render(<AppBrandIcon isDark={false} fit="contain" />);
    const imgLight = getImage(screenLight);
    const imgLightStyle = StyleSheet.flatten(imgLight.props.style);

    expect(imgLight.props.resizeMode).toBe('contain');
    expect(imgLightStyle.transform?.[0]?.scale).toBeCloseTo(1.7, 5);

    const screenDark = render(<AppBrandIcon isDark fit="contain" />);
    const imgDark = getImage(screenDark);
    const imgDarkStyle = StyleSheet.flatten(imgDark.props.style);

    expect(imgDark.props.resizeMode).toBe('contain');
    expect(imgDarkStyle.transform?.[0]?.scale).toBeCloseTo(1.25, 5);

    // containZoom=1 disables the extra transform
    const screenNoZoom = render(<AppBrandIcon isDark={false} fit="contain" containZoom={1} />);
    const imgNoZoom = getImage(screenNoZoom);
    const imgNoZoomStyle = StyleSheet.flatten(imgNoZoom.props.style);

    expect(imgNoZoomStyle.transform).toBeUndefined();
  });
});
