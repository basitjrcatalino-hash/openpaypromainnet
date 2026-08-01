import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ChromeVisibleApi = {
  visible: boolean;
  /** Temporarily force-hide header/tabbar (e.g. Trade Long/Short menu). */
  setForceHidden: (hidden: boolean) => void;
};

const ChromeVisibleContext = createContext<ChromeVisibleApi>({
  visible: true,
  setForceHidden: () => {},
});

export function ChromeVisibleProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  const [forceHidden, setForceHiddenState] = useState(false);
  const setForceHidden = useCallback((hidden: boolean) => {
    setForceHiddenState(hidden);
  }, []);

  const api = useMemo<ChromeVisibleApi>(
    () => ({
      visible: forceHidden ? false : value,
      setForceHidden,
    }),
    [forceHidden, value, setForceHidden],
  );

  return (
    <ChromeVisibleContext.Provider value={api}>{children}</ChromeVisibleContext.Provider>
  );
}

/** True when header + tabbar should be shown. */
export function useChromeVisible() {
  return useContext(ChromeVisibleContext).visible;
}

/** Force-hide chrome while a local overlay (Trade menu) needs the screen. */
export function useChromeForceHidden() {
  return useContext(ChromeVisibleContext).setForceHidden;
}
