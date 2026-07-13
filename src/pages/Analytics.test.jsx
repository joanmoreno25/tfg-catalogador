import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Analytics from './Analytics';
import { useAuth } from '../context/AuthContext';
import { getDocs } from 'firebase/firestore';

// 1. MOCK EXTERNAL DEPENDENCIES

// Mock React Router to prevent navigation errors
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn()
}));

// Mock i18next translation hook
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'es' }
  })
}));

// Mock AuthContext to simulate a logged-in user
jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn()
}));

// Mock Firebase config to prevent real initialization in terminal
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
  getDocs: jest.fn(),
  getFirestore: jest.fn()
}));

// Mock Helmet to prevent head modification issues
jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }) => <div data-testid="helmet">{children}</div>
}));

// Mock Recharts to avoid rendering SVG sizing issues
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  LineChart: () => <div data-testid="line-chart" />,
  Line: () => null,
  PieChart: () => <div data-testid="pie-chart" />,
  Pie: () => null,
  Cell: () => null,
  Legend: () => null
}));

// 2. TEST SUITE
describe('Analytics Component', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TEST 1: Initial Loading State
  it('should render the loading spinner initially', () => {
    useAuth.mockReturnValue({ currentUser: { uid: 'user123' } });
    getDocs.mockReturnValue(new Promise(() => {}));

    render(<Analytics />);

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  // TEST 2: Successful Data Fetch and Metric Calculation
  it('should fetch data, calculate metrics correctly, and render charts', async () => {
    useAuth.mockReturnValue({ currentUser: { uid: 'user123' } });

    const mockData = [
      {
        textoDetectado: "Oferta especial 50%",
        fechaCreacion: { toDate: () => new Date('2026-06-13') },
        etiquetas: [
          { nombre: "Promoción", nombres: { es: "Promoción" }, confianza: 95 },
          { nombre: "Logo", nombres: { es: "Logo" }, confianza: 85 }
        ]
      },
      {
        textoDetectado: "Compra ahora",
        fechaCreacion: { toDate: () => new Date('2026-06-14') },
        etiquetas: [
          { nombre: "Zapatos", nombres: { es: "Zapatos" }, confianza: 90 }
        ]
      }
    ];

    getDocs.mockResolvedValue({
      docs: mockData.map(data => ({ data: () => data }))
    });

    render(<Analytics />);

    await waitFor(() => {
      // Total assets should be 2
      expect(screen.getByText('2')).toBeInTheDocument();
      
      // Avg confidence calculation: (95 + 85 + 90) / 3 = 90.0
      expect(screen.getByText('90.0%')).toBeInTheDocument();
      
      // Total texts character count: 19 ("Oferta especial 50%") + 12 ("Compra ahora") = 31
      expect(screen.getByText('31')).toBeInTheDocument();
    });

    // Verify charts are rendered
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

});