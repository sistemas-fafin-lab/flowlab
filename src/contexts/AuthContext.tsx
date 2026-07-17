import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { UserProfile, UserRole } from "../types";
import { getPermissionsForLegacyRole } from "../utils/permissions";

const normalizeCPF = (cpf: string): string => {
  return cpf.replace(/\D/g, "").trim();
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isInitialized: boolean;
  pendingAuthError: string | null;
  signUp: (
    email: string,
    password: string,
    name?: string,
    department?: string,
    cpf?: string,
  ) => Promise<{ data: any; error: any }>;
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signOut: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ data: any; error: any }>;
  updateUserRole: (
    userId: string,
    newRole: UserRole,
    customRoleId?: string,
  ) => Promise<{ success: boolean; error?: any }>;
  refreshProfile: () => void;
  authenticated: boolean;
  clearPendingAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [pendingAuthError, setPendingAuthError] = useState<string | null>(null);

  const userProfileRef = useRef<UserProfile | null>(null);
  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*, custom_roles(id, name, permissions)")
        .eq("id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Erro ao carregar perfil:", error);
        setLoading(false);
        return;
      }

      if (data) {
        const customRole = data.custom_roles as any;
        const permissions: string[] =
          customRole?.permissions || getPermissionsForLegacyRole(data.role);

        setUserProfile({
          id: data.id,
          email: data.email,
          name: data.name,
          role: data.role,
          department: data.department,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          customRoleId: data.custom_role_id,
          permissions,
          roleName: customRole?.name,
        });
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
        setIsInitialized(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") {
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const shouldReloadProfile =
          (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
          !userProfileRef.current;

        if (shouldReloadProfile) {
          setLoading(true);
          loadUserProfile(session.user.id);
        }
      } else {
        if (event === "SIGNED_OUT") {
          setUserProfile(null);
          setLoading(false);
          setIsInitialized(false);
        }
      }

      if (event === "INITIAL_SESSION") {
        setIsInitialized(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserProfile]);

  const signUp = async (
    email: string,
    password: string,
    name?: string,
    department?: string,
    cpf?: string,
  ) => {
    if (!department) {
      throw new Error("Departamento é obrigatório.");
    }

    if (!cpf) {
      throw new Error("CPF é obrigatório.");
    }

    const normalizedCPF = normalizeCPF(cpf);

    if (normalizedCPF.length !== 11) {
      throw new Error("CPF inválido. Deve conter 11 dígitos.");
    }

    const { data: whitelistEntry, error: whitelistError } = await supabase
      .from("user_whitelist")
      .select("cpf, name, activity")
      .eq("cpf", normalizedCPF)
      .single();

    if (whitelistError || !whitelistEntry) {
      throw new Error("CPF não autorizado para cadastro.");
    }

    if (!whitelistEntry.activity) {
      throw new Error("CPF inativo. Contate o administrador.");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split("@")[0],
          department,
        },
      },
    });

    if (data.user && !error) {
      const existingProfiles = await supabase
        .from("user_profiles")
        .select("id")
        .limit(1);

      const defaultRole: UserRole =
        existingProfiles.data?.length === 0 ? "admin" : "requester";

      const { error: insertError } = await supabase
        .from("user_profiles")
        .insert({
          id: data.user.id,
          email,
          name: name || email.split("@")[0],
          role: defaultRole,
          department,
          cpf: normalizedCPF,
        });

      if (insertError) {
        console.error("Erro ao inserir perfil:", insertError);
      }

      await loadUserProfile(data.user.id);
    }

    return { data, error };
  };

  const resetPassword = async (email: string) => {
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return { data, error };
    }

    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("cpf")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profileData?.cpf) {
      setPendingAuthError("Acesso não autorizado. Contate o administrador.");
      await supabase.auth.signOut({ scope: "local" });
      return {
        data: null as any,
        error: new Error("Acesso não autorizado. Contate o administrador.") as any,
      };
    }

    const { data: whitelistEntry, error: whitelistError } = await supabase
      .from("user_whitelist")
      .select("activity")
      .eq("cpf", profileData.cpf)
      .single();

    if (whitelistError || !whitelistEntry || !whitelistEntry.activity) {
      setPendingAuthError("Acesso não autorizado. Contate o administrador.");
      await supabase.auth.signOut({ scope: "local" });
      return {
        data: null as any,
        error: new Error("Acesso não autorizado. Contate o administrador.") as any,
      };
    }

    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    setUserProfile(null);
    setPendingAuthError(null);
    return { error };
  };

  const updateUserRole = async (
    userId: string,
    newRole: UserRole,
    customRoleId?: string,
  ) => {
    try {
      const updateData: any = {
        role: newRole,
        updated_at: new Date().toISOString(),
      };
      if (customRoleId) updateData.custom_role_id = customRoleId;

      const { error } = await supabase
        .from("user_profiles")
        .update(updateData)
        .eq("id", userId);

      if (error) throw error;

      if (userId === user?.id) {
        await loadUserProfile(userId);
      }

      return { success: true };
    } catch (error) {
      console.error("Erro ao atualizar role do usuário:", error);
      return { success: false, error };
    }
  };

  const clearPendingAuthError = useCallback(() => {
    setPendingAuthError(null);
  }, []);

  const refreshProfile = useCallback(() => {
    if (user) loadUserProfile(user.id);
  }, [user, loadUserProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userProfile,
        loading,
        isInitialized,
        pendingAuthError,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updateUserRole,
        refreshProfile,
        authenticated: !!session,
        clearPendingAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};
