import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';
import { sendPasswordResetEmail } from 'firebase/auth';

// 1. MOCK EXTERNAL DEPENDENCIES

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  sendPasswordResetEmail: jest.fn()
}));

// Mock Firebase Config
jest.mock('../firebase-config', () => ({
  auth: {}
}));

// Mock React Helmet
jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }) => <div data-testid="helmet">{children}</div>
}));

// Mock Image
jest.mock('../assets/logo-v2.png', () => 'logo-mock.png');

// 2. TEST SUITE
describe('ForgotPassword Component', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ForgotPassword />
      </BrowserRouter>
    );
  };

  // TEST 1: Renderizado inicial (Smoke Test)
  it('should render the form and elements correctly', () => {
    renderComponent();
    
    expect(screen.getByPlaceholderText('tu-correo@ejemplo.com')).toBeInTheDocument();
    expect(screen.getByText('Enviar enlace')).toBeInTheDocument();
    expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
  });

  // TEST 2: Validación de campo vacío
  it('should show a validation error if email is empty', async () => {
    renderComponent();
    
    fireEvent.click(screen.getByText('Enviar enlace'));
    
    // Verificamos el mensaje de error y que Firebase no se haya llamado
    expect(await screen.findByText('Por favor, introduce tu correo electrónico.')).toBeInTheDocument();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  // TEST 3: Camino Feliz (Éxito al enviar el correo)
  it('should handle successful password reset request', async () => {
    renderComponent();
    
    // Falsificamos una respuesta exitosa de Firebase
    sendPasswordResetEmail.mockResolvedValueOnce();

    const emailInput = screen.getByPlaceholderText('tu-correo@ejemplo.com');
    fireEvent.change(emailInput, { target: { value: 'test@ejemplo.com' } });
    fireEvent.click(screen.getByText('Enviar enlace'));

    // Verificamos que el botón cambia a estado de carga
    expect(screen.getByText('Enviando...')).toBeInTheDocument();

    await waitFor(() => {
      // Verificamos que se envía el correo exacto a Firebase
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(expect.anything(), 'test@ejemplo.com');
    });

    // Verificamos mensaje de éxito y que el input se vacía
    expect(await screen.findByText('Enlace de recuperación enviado. Revisa tu bandeja de entrada.')).toBeInTheDocument();
    expect(emailInput.value).toBe('');
  });

  // TEST 4: Error - Usuario no encontrado
  it('should handle user-not-found error from Firebase', async () => {
    renderComponent();
    
    // Falsificamos un error específico de Firebase
    sendPasswordResetEmail.mockRejectedValueOnce({ code: 'auth/user-not-found' });

    fireEvent.change(screen.getByPlaceholderText('tu-correo@ejemplo.com'), { target: { value: 'fantasma@ejemplo.com' } });
    fireEvent.click(screen.getByText('Enviar enlace'));

    expect(await screen.findByText('No existe ninguna cuenta con este correo electrónico.')).toBeInTheDocument();
  });

  // TEST 5: Error - Fallo genérico
  it('should handle generic errors from Firebase', async () => {
    renderComponent();
    
    // Falsificamos un error genérico (ej. sin internet)
    sendPasswordResetEmail.mockRejectedValueOnce(new Error('Network error'));

    fireEvent.change(screen.getByPlaceholderText('tu-correo@ejemplo.com'), { target: { value: 'error@ejemplo.com' } });
    fireEvent.click(screen.getByText('Enviar enlace'));

    expect(await screen.findByText('Error al enviar el correo. Inténtalo de nuevo más tarde.')).toBeInTheDocument();
  });

});