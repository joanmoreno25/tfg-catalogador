import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Terms from './Terms';

// 1. MOCK EXTERNAL DEPENDENCIES
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }) => <div data-testid="helmet">{children}</div>
}));

jest.mock('../assets/logo-v2.png', () => 'logo-mock.png');

// 2. TEST SUITE
describe('Terms Component', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderTerms = () => {
    return render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Terms />
      </BrowserRouter>
    );
  };

  // TEST 1: Renderizado del texto legal
  it('should render the terms and conditions text', () => {
    renderTerms();
    
    // Comprobamos que los títulos y fechas importantes están presentes
    expect(screen.getByText('Términos y Condiciones Generales de Uso')).toBeInTheDocument();
    expect(screen.getByText(/Última actualización: 13 de Junio de 2026/i)).toBeInTheDocument();
    expect(screen.getByText('1. Objeto y Ámbito de Aplicación')).toBeInTheDocument();
    expect(screen.getByText('11. Legislación Aplicable y Jurisdicción')).toBeInTheDocument();
  });

  // TEST 2: Lógica de navegación "Volver Atrás"
  it('should navigate back (-1) in history when back button is clicked', () => {
    renderTerms();
    
    // Hay dos botones de "Volver atrás" (uno arriba y otro abajo). Hacemos clic en el primero.
    const backButtons = screen.getAllByText('Volver atrás');
    fireEvent.click(backButtons[0]);

    // Comprobamos que el router recibió la orden "-1" (Ir a la página anterior en el historial)
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

});