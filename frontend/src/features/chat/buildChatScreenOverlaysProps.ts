import type React from 'react';

import type { ChatScreenOverlays } from './components/ChatScreenOverlays';

type OverlaysProps = React.ComponentProps<typeof ChatScreenOverlays>;

export function buildChatScreenOverlaysProps(deps: OverlaysProps): OverlaysProps {
  // Pure builder wrapper: keeps ChatScreen.tsx leaner by moving the giant literal out.
  return deps;
}
