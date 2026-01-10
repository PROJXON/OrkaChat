import * as React from 'react';

export type MenuAnchorRect = { x: number; y: number; width: number; height: number };

type MeasurableNode = {
  measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

export function useMenuAnchor<TRef = any>(): {
  ref: React.MutableRefObject<TRef | null>;
  anchor: MenuAnchorRect | null;
  setAnchor: React.Dispatch<React.SetStateAction<MenuAnchorRect | null>>;
  openFromRef: (opts: { enabled: boolean; onOpen: () => void }) => void;
} {
  const ref = React.useRef<TRef | null>(null);
  const [anchor, setAnchor] = React.useState<MenuAnchorRect | null>(null);

  const openFromRef = React.useCallback(
    (opts: { enabled: boolean; onOpen: () => void }) => {
      const { enabled, onOpen } = opts;
      const node = ref.current as unknown as MeasurableNode | null;
      if (enabled && node && typeof node.measureInWindow === 'function') {
        node.measureInWindow((x: number, y: number, w: number, h: number) => {
          setAnchor({ x, y, width: w, height: h });
          onOpen();
        });
        return;
      }
      setAnchor(null);
      onOpen();
    },
    [],
  );

  return { ref, anchor, setAnchor, openFromRef };
}

