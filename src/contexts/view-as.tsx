import { createContext, useContext, useState } from "react";

type PreviewRole = "client" | "crew" | null;

interface ViewAsContextValue {
  previewRole: PreviewRole;
  setPreviewRole: (role: PreviewRole) => void;
}

const ViewAsContext = createContext<ViewAsContextValue>({
  previewRole: null,
  setPreviewRole: () => {},
});

export function ViewAsProvider({ children }: { children: React.ReactNode }) {
  const [previewRole, setPreviewRole] = useState<PreviewRole>(null);
  return (
    <ViewAsContext.Provider value={{ previewRole, setPreviewRole }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  return useContext(ViewAsContext);
}
