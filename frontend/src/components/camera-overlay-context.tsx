import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type CameraOverlayContextValue = {
  isCameraOpen: boolean;
  setIsCameraOpen: (isOpen: boolean) => void;
};

const CameraOverlayContext = createContext<CameraOverlayContextValue | null>(null);

export function CameraOverlayProvider({ children }: { children: ReactNode }) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const value = useMemo(() => ({ isCameraOpen, setIsCameraOpen }), [isCameraOpen]);

  return <CameraOverlayContext.Provider value={value}>{children}</CameraOverlayContext.Provider>;
}

export function useCameraOverlay() {
  const context = useContext(CameraOverlayContext);
  if (!context) {
    throw new Error('useCameraOverlay must be used inside CameraOverlayProvider.');
  }
  return context;
}
