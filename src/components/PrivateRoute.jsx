import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  
  // Si hay usuario, renderiza el componente hijo (Dashboard). Si no, redirige al Login.
  return currentUser ? children : <Navigate to="/login" />;
};

export default PrivateRoute;