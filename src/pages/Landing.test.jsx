import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Landing from './Landing';

// 1. MOCK EXTERNAL DEPENDENCIES

// Mockeamos el componente Navbar para aislar el test de la Landing. 
// No queremos que si el Navbar falla, la Landing también falle en el test.
jest.mock('../components/Navbar', () => () => <div data-testid="navbar-mock">Navbar</div>);

// Mock React Helmet
jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }) => <div data-testid="helmet">{children}</div>
}));

// Mock de todas las imágenes estáticas para evitar fallos de Webpack en Jest
jest.mock('../assets/hero-mockup.png', () => 'hero-mockup.png');
jest.mock('../assets/feature1-mockup.png', () => 'feature1-mockup.png');
jest.mock('../assets/feature2-mockup.png', () => 'feature2-mockup.png');
jest.mock('../assets/underline.png', () => 'underline.png');
jest.mock('../assets/security-mockup.png', () => 'security-mockup.png');
jest.mock('../assets/logo.svg', () => 'logo.svg');

// 2. TEST SUITE
describe('Landing Component', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Reiniciamos el scroll a 0 antes de cada test por seguridad
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  });

  const renderLanding = () => {
    return render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Landing />
      </BrowserRouter>
    );
  };

  // TEST 1: Renderizado inicial de las secciones principales (Smoke Test)
  it('should render all main sections correctly', () => {
    renderLanding();
    
    // Verificamos que el Navbar está presente
    expect(screen.getByTestId('navbar-mock')).toBeInTheDocument();

    // Verificamos títulos de las secciones principales
    expect(screen.getByText(/Gestión Inteligente de/i)).toBeInTheDocument();
    expect(screen.getByText(/Extracción de Texto/i)).toBeInTheDocument();
    expect(screen.getByText(/Etiquetado/i)).toBeInTheDocument();
    expect(screen.getByText(/Seguridad y/i)).toBeInTheDocument();
  });

  // TEST 2: Comprobar los enlaces de navegación (Routing)
  it('should contain correct navigation links to Login and Register', () => {
    renderLanding();

    // Comprobamos el enlace del Hero (botón principal)
    const loginLink = screen.getByText('Procesar mi primera imagen').closest('a');
    expect(loginLink).toHaveAttribute('href', '/login');

    // Comprobamos los enlaces de registro en las secciones de CTA
    const registerLink1 = screen.getByText('Crear cuenta gratuita').closest('a');
    expect(registerLink1).toHaveAttribute('href', '/register');

    const registerLink2 = screen.getByText('Crear cuenta gratis').closest('a');
    expect(registerLink2).toHaveAttribute('href', '/register');
  });

  // TEST 3: El evento de Scroll del Navbar (El efecto cristal)
  it('should change header styling when user scrolls down', () => {
    renderLanding();
    
    // 1. Buscamos el contenedor padre del Navbar (el envoltorio fijo)
    const headerWrapper = screen.getByTestId('navbar-mock').parentElement;

    // 2. Comprobamos que al inicio tiene fondo transparente
    expect(headerWrapper.className).toContain('bg-transparent');
    expect(headerWrapper.className).not.toContain('bg-[#0F172A]/90');

    // 3. Simulamos que el usuario hace scroll hacia abajo (modificamos el valor de scrollY a 100)
    Object.defineProperty(window, 'scrollY', { value: 100, writable: true });
    fireEvent.scroll(window);

    // 4. Comprobamos que la clase ha cambiado al fondo oscuro con difuminado (backdrop-blur)
    expect(headerWrapper.className).toContain('bg-[#0F172A]/90');
    expect(headerWrapper.className).not.toContain('bg-transparent');
  });

});