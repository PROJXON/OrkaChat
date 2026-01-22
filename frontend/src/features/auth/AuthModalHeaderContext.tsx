import React from 'react';

type AuthModalHeaderContextValue = {
  title: string;
  setTitle: (t: string) => void;
};

const AuthModalHeaderContext = React.createContext<AuthModalHeaderContextValue | null>(null);

export function AuthModalHeaderProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [title, setTitle] = React.useState('');

  const value = React.useMemo<AuthModalHeaderContextValue>(
    () => ({
      title,
      setTitle,
    }),
    [title],
  );

  return (
    <AuthModalHeaderContext.Provider value={value}>{children}</AuthModalHeaderContext.Provider>
  );
}

export function useAuthModalHeader(): AuthModalHeaderContextValue | null {
  return React.useContext(AuthModalHeaderContext);
}
