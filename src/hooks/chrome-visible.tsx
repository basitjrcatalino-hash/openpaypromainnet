import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ChromeVisibleApi = {
  /** Header visibility (scroll up shows, scroll down hides). */
  headerVisible: boolean;
  /** Footer visibility (scroll up shows, scroll down hides). */
  footerVisible: boolean;
  /** @deprecated Use headerVisible or footerVisible. */
  visible: boolean;
  /** Temporarily force-hide header/tabbar (e.g. Trade Long/Short menu). */
  setForceHidden: (hidden: boolean) => void;
};

const ChromeVisibleContext = createContext<ChromeVisibleApi>({
  headerVisible: true,
  footerVisible: true,
  visible: true,
  setForceHidden: () => {},
});

export function ChromeVisibleProvider({
  headerVisible,
  footerVisible,
  children,
}: {
  headerVisible: boolean;
  footerVisible: boolean;
  children: ReactNode;
}) {
  const [forceHidden, setForceHiddenState] = useState(false);
  const setForceHidden = useCallback((hidden: boolean) => {
    setForceHiddenState(hidden);
  }, []);

  const api = useMemo<ChromeVisibleApi>(
    () => ({
      headerVisible: forceHidden ? false : headerVisible,
      footerVisible: forceHidden ? false : footerVisible,
      visible: forceHidden ? false : headerVisible,
      setForceHidden,
    }),
    [forceHidden, headerVisible, footerVisible, setForceHidden],
  );

  return (
    <ChromeVisibleContext.Provider value={api}>{children}</ChromeVisibleContext.Provider>
  );
}

/** True when header should be shown. */
export function useHeaderVisible() {
  return useContext(ChromeVisibleContext).headerVisible;
}

/** True when footer/tabbar should be shown. */
export function useFooterVisible() {
  return useContext(ChromeVisibleContext).footerVisible;
}

/** True when header + tabbar should be shown. */
export function useChromeVisible() {
  return useContext(ChromeVisibleContext).visible;
}

/** Force-hide chrome while a local overlay (Trade menu) needs the screen. */
export function useChromeForceHidden() {
  return useContext(ChromeVisibleContext).setForceHidden;
}

