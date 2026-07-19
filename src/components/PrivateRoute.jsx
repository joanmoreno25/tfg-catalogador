import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * PrivateRoute component.
 * Acts as an authentication guard for protected application routes. 
 * Validates the current user's session state and conditionally renders 
 * the requested child components or redirects unauthorized users.
 *
 * @param {Object} props - Component properties.
 * @param {React.ReactNode} props.children - The child components to render if the user is authenticated.
 * @returns {JSX.Element} The child components, or a React Router Navigate component targeting the login endpoint.
 */
const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  
  // Render child components if the user is authenticated; otherwise, redirect to the login page.
  return currentUser ? children : <Navigate to="/login" />;
};

export default PrivateRoute;