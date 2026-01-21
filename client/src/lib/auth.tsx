import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  forcePasswordChange?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ forcePasswordChange: boolean }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isStaff: boolean;
  isClient: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("token");
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          localStorage.removeItem("token");
          setToken(null);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.removeItem("token");
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, [token]);

  const refreshUser = useCallback(async () => {
    const currentToken = localStorage.getItem("token");
    if (!currentToken) return;
    
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error("Invalid credentials");
    }

    const data = await response.json();
    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser({
      ...data.user,
      forcePasswordChange: data.user.forcePasswordChange || false,
    });
    
    return { forcePasswordChange: data.user.forcePasswordChange || false };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  const isStaff = user?.role === "admin" || user?.role === "analyst";
  const isClient = user?.role === "client";
  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        refreshUser,
        isAuthenticated: !!user,
        isStaff,
        isClient,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
