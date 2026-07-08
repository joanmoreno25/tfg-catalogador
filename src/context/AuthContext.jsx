import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase-config";

// 1. Creamos el contexto
const AuthContext = createContext();

// 2. Exportamos un hook personalizado para usarlo fácilmente en otros componentes
export const useAuth = () => {
  return useContext(AuthContext);
};

// 3. Creamos el componente proveedor
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Este observador de Firebase se dispara cada vez que hay un login o logout
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    // Limpiamos el observador cuando el componente se desmonta
    return unsubscribe;
  }, []);

  const value = {
    currentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};