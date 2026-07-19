import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase-config";

/**
 * Authentication context to manage global user state.
 */
const AuthContext = createContext();

/**
 * Custom hook to consume the authentication context.
 * 
 * @returns {Object} The current authentication context value containing the user state.
 */
export const useAuth = () => {
  return useContext(AuthContext);
};

/**
 * Authentication provider component.
 * Wraps the application to provide the current user state and handles Firebase auth state changes.
 * 
 * @param {Object} props - Component properties.
 * @param {React.ReactNode} props.children - Child components to render.
 * @returns {JSX.Element} The rendered provider component.
 */
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firebase observer that triggers on user login or logout events
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    // Cleanup the observer when the component unmounts
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