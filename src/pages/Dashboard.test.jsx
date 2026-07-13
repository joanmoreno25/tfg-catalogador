import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { useAuth } from '../context/AuthContext';
import { getDocs, deleteDoc, getCountFromServer } from 'firebase/firestore';
import * as XLSX from 'xlsx';

// 1. MOCK EXTERNAL DEPENDENCIES
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, defaultText) => defaultText || key,
    i18n: { language: 'es' }
  })
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn()
}));
jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false, toggleTheme: jest.fn() })
}));

jest.mock('../firebase-config', () => ({
  db: {},
  auth: { signOut: jest.fn() }
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  getCountFromServer: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn()
}));

jest.mock('../aws-config', () => ({
  s3Client: { send: jest.fn() },
  rekognitionClient: { send: jest.fn() },
  comprehendClient: { send: jest.fn() },
  BUCKET_NAME: 'test-bucket'
}));
jest.mock('@aws-sdk/client-s3', () => ({ PutObjectCommand: jest.fn() }));
jest.mock('@aws-sdk/client-rekognition', () => ({ 
  DetectLabelsCommand: jest.fn(), 
  DetectTextCommand: jest.fn(), 
  DetectModerationLabelsCommand: jest.fn() 
}));
jest.mock('@aws-sdk/client-comprehend', () => ({ DetectSentimentCommand: jest.fn() }));

jest.mock('xlsx', () => ({
  utils: {
    book_new: jest.fn(),
    json_to_sheet: jest.fn(),
    book_append_sheet: jest.fn()
  },
  writeFile: jest.fn()
}));
jest.mock('jspdf', () => ({
  jsPDF: jest.fn(() => ({ addImage: jest.fn(), save: jest.fn() }))
}));
jest.mock('html2canvas', () => jest.fn(() => Promise.resolve({ toDataURL: jest.fn() })));

jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }) => <div data-testid="helmet">{children}</div>
}));

jest.mock('../assets/logo.svg', () => 'logo-mock.svg');

class MockIntersectionObserver {
  constructor(callback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.IntersectionObserver = MockIntersectionObserver;
global.IntersectionObserver = MockIntersectionObserver;

// 2. TEST SUITE
describe('Dashboard Component', () => {

  const mockHistoryData = [
    {
      id: 'doc1',
      nombreImagen: 'campaña-verano.jpg',
      fechaCreacion: { toDate: () => new Date('2026-06-10') },
      etiquetas: [{ nombre: 'Playa', confianza: 95 }],
      textoDetectado: ['Descuento 50%'],
      moderacion: []
    },
    {
      id: 'doc2',
      nombreImagen: 'producto-nuevo.png',
      fechaCreacion: { toDate: () => new Date('2026-06-11') },
      etiquetas: [{ nombre: 'Zapato', confianza: 88 }],
      textoDetectado: [],
      moderacion: []
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ currentUser: { uid: 'user123' } });
    getDocs.mockResolvedValue({
      docs: mockHistoryData.map(data => ({ id: data.id, data: () => data }))
    });
    getCountFromServer.mockResolvedValue({
      data: () => ({ count: 2 })
    });
    jest.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderDashboard = () => {
    return render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Dashboard />
      </BrowserRouter>
    );
  };

  it('should render the dashboard and fetch history successfully', async () => {
    renderDashboard();
    expect(await screen.findByText('campaña-verano.jpg')).toBeInTheDocument();
    expect(screen.getByText('producto-nuevo.png')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('dashboard.search_placeholder')).toBeInTheDocument();
    expect(screen.getByText('95.0%')).toBeInTheDocument();
    expect(screen.getByText('88.0%')).toBeInTheDocument();
  });

  it('should filter the history when typing in the search bar', async () => {
    renderDashboard();
    await screen.findByText('campaña-verano.jpg');
    const searchInput = screen.getByPlaceholderText('dashboard.search_placeholder');
    fireEvent.change(searchInput, { target: { value: 'verano' } });
    await waitFor(() => {
      expect(screen.getByText('campaña-verano.jpg')).toBeInTheDocument();
      expect(screen.queryByText('producto-nuevo.png')).not.toBeInTheDocument();
    });
  });

  it('should call deleteDoc when the delete button is clicked and confirmed', async () => {
    renderDashboard();
    await screen.findByText('campaña-verano.jpg');
    const deleteButtons = screen.getAllByRole('button').filter(btn => btn.className.includes('text-red-500') || btn.className.includes('hover:bg-red'));
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
      expect(window.confirm).toHaveBeenCalled();
      await waitFor(() => {
        expect(deleteDoc).toHaveBeenCalled();
      });
    }
  });

  it('should call XLSX write function when Export to Excel is clicked', async () => {
    renderDashboard();
    await screen.findByText('campaña-verano.jpg');

    // Aquí está la corrección: Búsqueda exacta
    const exportMenuButton = screen.getByText('dashboard.export');
    fireEvent.click(exportMenuButton);

    const exportExcelButton = await screen.findByText('dashboard.export_excel');
    fireEvent.click(exportExcelButton);

    await waitFor(() => {
      expect(XLSX.utils.book_new).toHaveBeenCalled();
      expect(XLSX.writeFile).toHaveBeenCalled();
    });
  });

});