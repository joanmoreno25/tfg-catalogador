import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Register from './Register';
import { signInWithPopup, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

// 1. MOCK EXTERNAL DEPENDENCIES
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

jest.mock('firebase/auth', () => ({
  signInWithPopup: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  updateProfile: jest.fn()
}));

jest.mock('../firebase-config', () => ({
  auth: {}
}));

jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }) => <div data-testid="helmet">{children}</div>
}));

jest.mock('../assets/logo-v2.png', () => 'logo-mock.png');
jest.mock('../assets/register-image.png', () => 'register-image-mock.png');

// 2. TEST SUITE
describe('Register Component', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderRegister = () => {
    return render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Register />
      </BrowserRouter>
    );
  };

  // TEST 1: Smoke Test
  it('should render all form elements correctly', () => {
    renderRegister();
    expect(screen.getByPlaceholderText('Ej. Ana García')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ana.garcia@ejemplo.com')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('••••••••')).toHaveLength(2);
    
    // CORRECCIÓN: Buscamos específicamente un rol "botón" para ignorar el <h1>
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
  });

  // TEST 2: Validaciones del Formulario (Contraseña débil y campos vacíos)
  it('should validate empty fields, weak passwords and unaccepted terms', async () => {
    renderRegister();
    
    // CORRECCIÓN: Buscamos específicamente el botón
    const submitBtn = screen.getByRole('button', { name: 'Crear cuenta' });

    // 1. Intento sin rellenar nada
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Todos los campos son obligatorios.')).toBeInTheDocument();

    // 2. Intento con correo inválido
    fireEvent.change(screen.getByPlaceholderText('Ej. Ana García'), { target: { value: 'Joan' } });
    fireEvent.change(screen.getByPlaceholderText('ana.garcia@ejemplo.com'), { target: { value: 'correo-falso' } });
    fireEvent.change(screen.getAllByPlaceholderText('••••••••')[0], { target: { value: 'Password123!' } });
    fireEvent.change(screen.getAllByPlaceholderText('••••••••')[1], { target: { value: 'Password123!' } });
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Por favor, introduce un correo electrónico válido.')).toBeInTheDocument();

    // 3. Intento con contraseñas que no coinciden
    fireEvent.change(screen.getByPlaceholderText('ana.garcia@ejemplo.com'), { target: { value: 'joan@test.com' } });
    fireEvent.change(screen.getAllByPlaceholderText('••••••••')[1], { target: { value: 'Different123!' } });
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();

    // 4. Intento con contraseña débil y sin aceptar términos
    fireEvent.change(screen.getAllByPlaceholderText('••••••••')[0], { target: { value: '123' } });
    fireEvent.change(screen.getAllByPlaceholderText('••••••••')[1], { target: { value: '123' } });
    fireEvent.click(submitBtn);
    expect(await screen.findByText('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.')).toBeInTheDocument();

    // Comprobamos que Firebase no ha sido llamado debido a los errores de validación
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  // TEST 3: Camino Feliz de Registro
  it('should successfully register a user and navigate to dashboard', async () => {
    renderRegister();
    
    // Falsificamos respuesta exitosa de Firebase, devolviendo un usuario simulado
    const mockUser = { user: { uid: '123' } };
    createUserWithEmailAndPassword.mockResolvedValueOnce(mockUser);
    updateProfile.mockResolvedValueOnce();

    // Rellenamos el formulario correctamente
    fireEvent.change(screen.getByPlaceholderText('Ej. Ana García'), { target: { value: 'Joan Moreno' } });
    fireEvent.change(screen.getByPlaceholderText('ana.garcia@ejemplo.com'), { target: { value: 'joan@test.com' } });
    fireEvent.change(screen.getAllByPlaceholderText('••••••••')[0], { target: { value: 'Password123!' } });
    fireEvent.change(screen.getAllByPlaceholderText('••••••••')[1], { target: { value: 'Password123!' } });
    
    // Marcamos el checkbox de términos usando su ID
    const termsCheckbox = screen.getByRole('checkbox');
    fireEvent.click(termsCheckbox);

    // Enviamos
    // CORRECCIÓN: Usamos getByRole
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    // Esperamos las llamadas a Firebase
    await waitFor(() => {
      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'joan@test.com', 'Password123!');
      expect(updateProfile).toHaveBeenCalledWith(mockUser.user, { displayName: 'Joan Moreno' });
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  // TEST 4: Inicio de sesión con Google
  it('should call Google Sign-In and navigate on success', async () => {
    renderRegister();
    
    signInWithPopup.mockResolvedValueOnce({});
    
    fireEvent.click(screen.getByText('Continuar con Google'));

    await waitFor(() => {
      expect(signInWithPopup).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

});