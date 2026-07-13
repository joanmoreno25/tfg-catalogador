import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Compare from './Compare';
import { useAuth } from '../context/AuthContext';
import { getDocs } from 'firebase/firestore';

// 1. MOCK EXTERNAL DEPENDENCIES

// Mock React Router
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// Mock i18next translation hook
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, defaultText) => defaultText || key, // Return the default text provided in the component
    i18n: { language: 'es' }
  })
}));

// Mock AuthContext
jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn()
}));

// Mock Firebase config
jest.mock('../firebase-config', () => ({
  db: {},
  auth: {}
}));

// Mock Firebase Firestore functions
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  getDocs: jest.fn()
}));

// Mock AWS Config
jest.mock('../aws-config', () => ({
  BUCKET_NAME: 'test-bucket'
}));

// Mock Helmet
jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }) => <div data-testid="helmet">{children}</div>
}));

// Mock Recharts
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null
}));

// 2. TEST SUITE
describe('Compare Component', () => {

  const mockCatalogData = [
    {
      id: 'doc1',
      nombreImagen: 'coche-rojo.jpg',
      fechaCreacion: { toDate: () => new Date('2026-06-15') },
      etiquetas: [
        { nombre: 'Coche', nombres: { es: 'Coche' }, confianza: 90 },
        { nombre: 'Rueda', nombres: { es: 'Rueda' }, confianza: 80 }
      ], // Average Confidence: (90 + 80) / 2 = 85.0%
      textoDetectado: ['Oferta Especial', 'Compra Ahora'], // 2 lines of text
      moderacion: [], // Clean
      sentimiento: 'POSITIVE',
      coloresDominantes: ['#FF0000', '#000000']
    },
    {
      id: 'doc2',
      nombreImagen: 'pistola-juguete.jpg',
      fechaCreacion: { toDate: () => new Date('2026-06-16') },
      etiquetas: [
        { nombre: 'Arma', nombres: { es: 'Arma' }, confianza: 95 }
      ], // Average Confidence: 95.0%
      textoDetectado: ['Peligro'], // 1 line of text
      moderacion: ['Weapons'], // Flagged
      sentimiento: 'NEGATIVE',
      coloresDominantes: ['#333333']
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ currentUser: { uid: 'user123' } });
    getDocs.mockResolvedValue({
      docs: mockCatalogData.map(data => ({ id: data.id, data: () => data }))
    });
  });

  const renderCompare = () => {
    return render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Compare />
      </BrowserRouter>
    );
  };

  // TEST 1: Initial Render (Locked State)
  it('should render empty slots and locked comparison state initially', async () => {
    renderCompare();

    // The user should see prompts to select images
    expect(screen.getByText('Haz clic para seleccionar la Imagen A')).toBeInTheDocument();
    expect(screen.getByText('Haz clic para seleccionar la Imagen B')).toBeInTheDocument();

    // The comparative section should show the locked warning
    expect(screen.getByText('Análisis Gráfico Bloqueado')).toBeInTheDocument();
  });

  // TEST 2: Modal Interaction and Image Selection
  it('should open the catalog modal and allow selecting an image', async () => {
    renderCompare();

    // 1. Click the Variant A placeholder
    fireEvent.click(screen.getByText('Haz clic para seleccionar la Imagen A'));

    // 2. Wait for the modal to appear with the catalog items
    await waitFor(() => {
      expect(screen.getByText('Seleccionar del Catálogo - Variante A')).toBeInTheDocument();
      // Verify both mock images are loaded in the modal
      expect(screen.getByText('coche-rojo.jpg')).toBeInTheDocument();
      expect(screen.getByText('pistola-juguete.jpg')).toBeInTheDocument();
    });

    // 3. Click the first image in the catalog to select it
    fireEvent.click(screen.getByText('coche-rojo.jpg'));

    // 4. Verify the modal closes and the image is now rendered in Variant A slot
    await waitFor(() => {
      expect(screen.queryByText('Seleccionar del Catálogo - Variante A')).not.toBeInTheDocument();
      // The image name should now be visible in the main panel
      expect(screen.getAllByText('coche-rojo.jpg')[0]).toBeInTheDocument();
    });
  });

  // TEST 3: Comparative Math and Logic
  it('should calculate global metrics accurately when both images are selected', async () => {
    renderCompare();

    // Wait for data to load
    await waitFor(() => expect(getDocs).toHaveBeenCalled());

    // Select Image A (coche-rojo.jpg)
    fireEvent.click(screen.getByText('Haz clic para seleccionar la Imagen A'));
    await waitFor(() => screen.getByText('coche-rojo.jpg'));
    fireEvent.click(screen.getByText('coche-rojo.jpg'));

    // Select Image B (pistola-juguete.jpg)
    fireEvent.click(screen.getByText('Haz clic para seleccionar la Imagen B'));
    await waitFor(() => screen.getByText('pistola-juguete.jpg'));
    fireEvent.click(screen.getByText('pistola-juguete.jpg'));

    // Now both images are selected. The chart and metrics table should appear.
    await waitFor(() => {
      expect(screen.getByText('Resultados del Análisis Comparativo')).toBeInTheDocument();
    });

    // Verify Average Confidence Math: Var A (85.0%), Var B (95.0%)
    // The first 85.0% and 95.0% are in the individual image panels, the others are in the table
    expect(screen.getAllByText('85.0%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('95.0%').length).toBeGreaterThan(0);

    // Verify Extracted Tags Math: Var A (2), Var B (1)
    // We check the table rows specifically using 'within' or finding elements
    const tagsRowText = screen.getByText('Etiquetas Extraídas').closest('.grid');
    expect(within(tagsRowText).getByText('2')).toBeInTheDocument();
    expect(within(tagsRowText).getByText('1')).toBeInTheDocument();

    // Verify Text Lines Math: Var A (2 lines), Var B (1 line)
    const textLinesRowText = screen.getByText('Líneas de Texto').closest('.grid');
    expect(within(textLinesRowText).getByText('2')).toBeInTheDocument();
    expect(within(textLinesRowText).getByText('1')).toBeInTheDocument();

    // Verify Moderation Logic: Var A (Clean), Var B (Alerts)
    const modRowText = screen.getByText('Moderación').closest('.grid');
    expect(within(modRowText).getByText('Limpio')).toBeInTheDocument();
    expect(within(modRowText).getByText('Alertas')).toBeInTheDocument();
  });

});