import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Footer component.
 * Renders the application's global footer, including the brand logo, tagline,
 * navigation links grouped by category, and legal compliance links.
 *
 * @returns {JSX.Element} The rendered footer component.
 */
const Footer = () => {
  return (
    <footer className="bg-adv-dark text-gray-400 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-5 gap-12">
        {/* Brand Logo and Tagline */}
        <div className="col-span-2 md:col-span-2 pr-8">
          <Link to="/" className="text-3xl font-extrabold text-white mb-4 block">
            Ad<span className="text-adv-blue">Vision</span>
          </Link>
          <p className="text-gray-500 mb-4">Análisis publicitario avanzado impulsado por IA.</p>
          <p className="text-sm text-gray-600">© 2024 AdVision. Todos los derechos reservados.</p>
        </div>

        {/* Primary Navigation Link Columns */}
        {["Producto", "Recursos", "Empresa"].map((col) => (
          <div key={col}>
            <h4 className="font-semibold text-white mb-4">{col}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/features" className="hover:text-adv-blue">Características</Link></li>
              <li><Link to="/integrations" className="hover:text-adv-blue">Integraciones</Link></li>
              <li><Link to="/pricing" className="hover:text-adv-blue">Precios</Link></li>
            </ul>
          </div>
        ))}
        {/* Legal and Compliance Links */}
        <div>
          <h4 className="font-semibold text-white mb-4">Legal</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/terms" className="hover:text-adv-blue">Términos de Servicio</Link></li>
            <li><Link to="/privacy" className="hover:text-adv-blue">Política de Privacidad</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default Footer;