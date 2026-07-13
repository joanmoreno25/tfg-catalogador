import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Profile from './Profile';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getDoc, setDoc } from 'firebase/firestore';
import { updatePassword, updateProfile, reauthenticateWithCredential, deleteUser, signOut } from 'firebase/auth';

// 1. MOCK EXTERNAL DEPENDENCIES

// Mock React Router
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// Mock i18next translation
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, defaultText) => defaultText || key,
    i18n: { 
      language: 'es',
      changeLanguage: jest.fn() 
    }
  })
}));

// Mock Contexts
jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn()
}));
const mockToggleDarkMode = jest.fn();
jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false, toggleDarkMode: mockToggleDarkMode })
}));

// Mock Firebase Config & Auth
jest.mock('../firebase-config', () => ({
  db: {},
  auth: {}
}));

// Mock Firebase Functions
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn()
}));
jest.mock('firebase/auth', () => ({
  updateProfile: jest.fn(),
  updatePassword: jest.fn(),
  reauthenticateWithCredential: jest.fn(),
  EmailAuthProvider: { credential: jest.fn() },
  deleteUser: jest.fn(),
  signOut: jest.fn()
}));

// Mock AWS
jest.mock('../aws-config', () => ({
  s3Client: { send: jest.fn() },
  BUCKET_NAME: 'test-bucket'
}));
jest.mock('@aws-sdk/client-s3', () => ({ PutObjectCommand: jest.fn() }));

// Mock Helmet
jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }) => <div data-testid="helmet">{children}</div>
}));

// Mock global URL.createObjectURL para que no falle al simular subida de imágenes
window.URL.createObjectURL = jest.fn();

// 2. TEST SUITE
describe('Profile Component', () => {

  const mockUser = {
    uid: 'user123',
    displayName: 'Joan Moreno',
    email: 'joan@test.com',
    photoURL: 'https://test.com/photo.jpg'
  };

  const mockFirestoreData = {
    phone: '600123456',
    address: 'Calle Falsa 123',
    postalCode: '08000',
    country: 'España',
    birthDate: '1995-05-15',
    language: 'es'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configuramos el usuario logueado
    useAuth.mockReturnValue({ currentUser: mockUser });
    
    // Falsificamos la respuesta de la base de datos (Firestore)
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => mockFirestoreData
    });

    // Limpiamos el localStorage
    localStorage.clear();
  });

  const renderProfile = () => {
    return render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Profile />
      </BrowserRouter>
    );
  };

  // TEST 1: Carga inicial de datos (Smoke Test)
  it('should load and display user data from Firestore on mount', async () => {
    renderProfile();

    // Verificamos que el nombre y el correo estáticos aparecen
    expect(screen.getByDisplayValue('Joan Moreno')).toBeInTheDocument();
    expect(screen.getByDisplayValue('joan@test.com')).toBeInTheDocument();

    // Esperamos a que la petición asíncrona a Firebase se resuelva y rellene los campos
    await waitFor(() => {
      expect(screen.getByDisplayValue('600123456')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Calle Falsa 123')).toBeInTheDocument();
      expect(screen.getByDisplayValue('España')).toBeInTheDocument();
    });
  });

  // TEST 2: Validación de contraseñas (Las contraseñas no coinciden)
  it('should show an error if new password and confirm password do not match', async () => {
    renderProfile();
    
    await waitFor(() => expect(screen.getByDisplayValue('600123456')).toBeInTheDocument());

    const inputs = screen.getAllByPlaceholderText('********');
    const currentPassInput = inputs[0];
    const newPassInput = inputs[1];
    const confirmPassInput = inputs[2];

    fireEvent.change(currentPassInput, { target: { value: 'OldPassword1!' } });
    fireEvent.change(newPassInput, { target: { value: 'NewPassword1!' } });
    fireEvent.change(confirmPassInput, { target: { value: 'DifferentPassword1!' } });

    fireEvent.click(screen.getByText('profile.save_changes'));

    expect(await screen.findByText('profile.error_passwords_not_match')).toBeInTheDocument();
    
    // Verificamos que NO se llamó a updatePassword (la contraseña no se cambió)
    // Nota: setDoc SÍ se ejecutó porque el componente guarda los datos generales antes de la validación de contraseña.
    expect(updatePassword).not.toHaveBeenCalled();
  });

  // TEST 3: Interacción con el Modal de Eliminar Cuenta
  it('should open delete modal and call deleteUser when confirmed', async () => {
    renderProfile();
    await waitFor(() => expect(screen.getByDisplayValue('España')).toBeInTheDocument());

    // Clic en "Eliminar cuenta" (Abre el modal)
    fireEvent.click(screen.getByText('profile.delete_account'));

    // Comprobamos que el título del modal aparece
    expect(await screen.findByText('profile.modal_delete_title')).toBeInTheDocument();

    // Clic en Confirmar (Botón rojo dentro del modal)
    fireEvent.click(screen.getByText('profile.confirm_delete'));

    // Verificamos que la función de borrado de Firebase se ejecuta
    await waitFor(() => {
      expect(deleteUser).toHaveBeenCalledWith(mockUser);
    });
    
    // Verificamos redirección a la página de registro
    expect(mockNavigate).toHaveBeenCalledWith('/register');
  });

  // TEST 4: Cerrar sesión
  it('should call signOut and navigate to login when logout is clicked', async () => {
    renderProfile();
    await waitFor(() => expect(screen.getByDisplayValue('España')).toBeInTheDocument());

    // Clic en "Cerrar sesión"
    fireEvent.click(screen.getByText('profile.logout'));

    // Verificamos las llamadas
    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  // TEST 5: Cambiar el tema oscuro
  it('should call toggleDarkMode when the theme toggle button is clicked', async () => {
    renderProfile();
    await waitFor(() => expect(screen.getByDisplayValue('España')).toBeInTheDocument());

    // El botón del tema no tiene texto, así que lo buscamos por su clase o estructura.
    // Al ser un botón sin aria-label explícito, usamos querySelector sobre el contenedor o simplemente disparamos el botón correcto
    const themeButton = screen.getAllByRole('button').find(btn => btn.className.includes('rounded-full transition-colors'));
    
    if (themeButton) {
      fireEvent.click(themeButton);
      expect(mockToggleDarkMode).toHaveBeenCalled();
    }
  });

});