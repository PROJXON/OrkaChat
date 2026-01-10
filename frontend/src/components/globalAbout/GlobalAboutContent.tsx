import React from 'react';
import { Text } from 'react-native';
import { GLOBAL_ABOUT_TEXT, GLOBAL_ABOUT_TITLE } from '../../utils/globalAbout';
import { RichText } from '../RichText';

export type GlobalAboutContentProps = {
  isDark: boolean;
  titleStyle: any;
  bodyStyle: any;
  onOpenUrl?: (url: string) => void;
};

export function GlobalAboutContent({ isDark, titleStyle, bodyStyle, onOpenUrl }: GlobalAboutContentProps): React.JSX.Element {
  return (
    <>
      <Text style={titleStyle}>{GLOBAL_ABOUT_TITLE}</Text>
      <RichText
        text={GLOBAL_ABOUT_TEXT}
        isDark={isDark}
        style={bodyStyle}
        enableMentions={false}
        variant="neutral"
        onOpenUrl={onOpenUrl}
      />
    </>
  );
}

