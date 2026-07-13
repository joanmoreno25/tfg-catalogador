import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from './Login';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';

// 1. MOCK EXTERNAL DEPENDENCIES

// Mock navigation but keep other router functions (like <Link>) working
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// Mock Firebase Authentication functions
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  GoogleAuthProvider: jest.fn()
}));

// Mock Firebase Config
jest.mock('../firebase-config', () => ({
  auth: {}
}));

// Mock React Helmet
jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }) => <div data-testid="helmet">{children}</div>
}));

// Mock image imports to avoid Webpack file loader errors in Jest
jest.mock('../assets/logo-v2.png', () => 'logo-mock.png');
jest.mock('../assets/login-image.png', () => 'login-mock.png');

// 2. TEST SUITE
describe('Login Component', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to render component with Router (needed for <Link> tags)
  // Helper function to render component with Router
  const renderLogin = () => {
    return render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Login />
      </BrowserRouter>
    );
  };

  // TEST 1: Initial Render (Smoke Test)
  it('should render all form elements correctly', () => {
    renderLogin();

    // Check if main inputs and buttons exist
    expect(screen.getByPlaceholderText('ana.garcia@ejemplo.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByText('Iniciar Sesión')).toBeInTheDocument();
    expect(screen.getByText('Continuar con Google')).toBeInTheDocument();
  });

  // TEST 2: Validation Error
  it('should show an error message if fields are empty on submit', async () => {
    renderLogin();

    // Find the submit button and click it without filling the form
    const submitButton = screen.getByText('Iniciar Sesión');
    fireEvent.click(submitButton);

    // Expect the validation error message to appear
    expect(await screen.findByText('Todos los campos son obligatorios.')).toBeInTheDocument();
    
    // Ensure Firebase was NOT called to prevent empty requests
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  // TEST 3: Successful Email/Password Login
  it('should call Firebase auth and navigate to dashboard on successful login', async () => {
    renderLogin();

    // Setup the mock to simulate a successful Firebase login
    signInWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: '123' } });

    // Fill out the form simulating user typing
    fireEvent.change(screen.getByPlaceholderText('ana.garcia@ejemplo.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });

    // Submit the form
    fireEvent.click(screen.getByText('Iniciar Sesión'));

    // Verify Firebase was called with the correct credentials
    await waitFor(() => {
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith({}, 'test@test.com', 'password123');
    });

    // Verify navigation to dashboard
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  // TEST 4: Firebase Error Handling
  it('should show an error message if Firebase login fails', async () => {
    renderLogin();

    // Setup the mock to simulate a failed Firebase login (e.g. wrong password)
    signInWithEmailAndPassword.mockRejectedValueOnce(new Error('Auth failed'));

    // Fill out the form
    fireEvent.change(screen.getByPlaceholderText('ana.garcia@ejemplo.com'), { target: { value: 'wrong@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrongpass' } });

    // Submit the form
    fireEvent.click(screen.getByText('Iniciar Sesión'));

    // Verify error message is displayed on screen
    expect(await screen.findByText('Correo o contraseña incorrectos. Inténtalo de nuevo.')).toBeInTheDocument();
  });

});