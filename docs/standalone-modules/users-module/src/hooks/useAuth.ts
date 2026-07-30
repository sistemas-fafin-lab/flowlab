import { useState, useEffect, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { UserProfile, UserRole, Department } from "../types";
import { getPermissionsForLegacyRole } from "../utils/permissions";

const normalizeCPF = (cpf: string): string => {
  return cpf.replace(/\D/g, "").trim();
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Espelha userProfile numa ref para que o callback do onAuthStateChange
  // (registrado uma única vez com deps []) leia sempre o valor atual, e não
  // o null capturado no closure inicial. Sem isso, todo evento SIGNED_IN
  // reemitido pelo Supabase ao voltar o foco da aba dispararia um reload
  // desnecessário do perfil (e a remontagem da árvore via loading).
  const userProfileRef = useRef<UserProfile | null>(null);
  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    // Sessão inicial
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

    // Listener para mudanças de auth
    // Ignora eventos que não requerem recarregamento do perfil
    const {
      data: { subscription },
    } =     supabase.auth.onAuthStateChange((event, session) => {
      // Ignorar completamente eventos de refresh - não causam recarregamento
      if (event === 'TOKEN_REFRESHED') {
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      // Eventos que NÃO devem causar recarregamento do perfil:
      // - TOKEN_REFRESHED: já tratado acima (ignorado)
      // - INITIAL_SESSION: carregamento inicial (já tratado no getSession)
      // - SIGNED_IN: só recarregar se não temos perfil ainda
      // - USER_UPDATED: atualização de metadados, não afeta perfil
      if (session?.user) {
        // Só recarregar se for um SIGNED_IN e ainda não temos perfil
        // Ou se for INITIAL_SESSION (primeira carga)
        const shouldReloadProfile =
          (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && !userProfileRef.current;

        if (shouldReloadProfile) {
          setLoading(true);
          loadUserProfile(session.user.id);
        }
        // Para outros eventos com sessão válida, mantém o estado atual
      } else {
        // Só limpar se for um sign out real
        if (event === 'SIGNED_OUT') {
          setUserProfile(null);
          setLoading(false);
          setIsInitialized(false);
        }
      }

      // Marcar como inicializado após o primeiro evento
      if (event === 'INITIAL_SESSION') {
        setIsInitialized(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
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
  };

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

    // Verifica whitelist
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
      // Verifica se já existem perfis para definir se este será admin
      const existingProfiles = await supabase
        .from("user_profiles")
        .select("id")
        .limit(1);

      const defaultRole: UserRole =
        existingProfiles.data?.length === 0 ? "admin" : "requester";

      // Insere o perfil manualmente
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

    // Valida whitelist: busca perfil e verifica se CPF está ativo
    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("cpf")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profileData?.cpf) {
      await supabase.auth.signOut({ scope: "local" });
      return {
        data: null as any,
        error: new Error(
          "Acesso não autorizado. Contate o administrador.",
        ) as any,
      };
    }

    const { data: whitelistEntry, error: whitelistError } = await supabase
      .from("user_whitelist")
      .select("activity")
      .eq("cpf", profileData.cpf)
      .single();

    if (whitelistError || !whitelistEntry || !whitelistEntry.activity) {
      await supabase.auth.signOut({ scope: "local" });
      return {
        data: null as any,
        error: new Error(
          "Acesso não autorizado. Contate o administrador.",
        ) as any,
      };
    }

    return { data, error };
  };

  const signOut = async () => {
    // scope='local' clears only the local session from storage and does not
    // require a valid JWT, preventing a 403 when the token has already expired.
    const { error } = await supabase.auth.signOut({ scope: "local" });
    setUserProfile(null);
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

  return {
    user,
    session,
    userProfile,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateUserRole,
    refreshProfile: () => user && loadUserProfile(user.id),
    authenticated: !!session,
  };
};
