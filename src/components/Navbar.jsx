import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.svg';

/**
 * Navbar component.
 * Renders the top navigation bar containing the brand logo, anchor links 
 * to main sections, and authentication call-to-action buttons.
 *
 * @returns {JSX.Element} The rendered navigation bar component.
 */
const Navbar = () => {
  const navLinks = [
    { name: 'Funcionalidades', href: '#funcionalidades' },
    { name: 'Seguridad', href: '#seguridad' },
    { name: 'Tecnologías', href: '#tecnologias' }
  ];

  return (
    <nav className="w-full h-[92px] bg-transparent flex items-center justify-between px-[5%] lg:px-[8%]">
      
      {/* Left Section: Brand Logo and Name */}
      <a href="#inicio" className="flex items-center gap-4 cursor-pointer hover:opacity-90 transition-opacity">
        <img src={logo} alt="AdVision Logo" className="w-10 h-10 drop-shadow-md" />
        <span className="text-white text-[26px] font-bold tracking-tight drop-shadow-md">
          AdVision
        </span>
      </a>

      {/* Center Section: Primary Navigation Menu */}
      <div className="hidden lg:flex items-center gap-[180px]">
        {navLinks.map((item) => (
          <a 
            key={item.name} 
            href={item.href} 
            className="text-white text-[22px] font-semibold drop-shadow-md opacity-80 hover:opacity-100 hover:-translate-y-0.5 transition-all"
          >
            {item.name}
          </a>
        ))}
      </div>

      {/* Right Section: Authentication and Call-to-Action Buttons */}
      <div className="flex items-center gap-[16px]">
        <Link 
          to="/login" 
          className="bg-white text-[#0F172A] text-[16px] font-bold px-[32px] py-[12px] rounded-[8px] hover:bg-gray-200 transition-colors shadow-sm"
        >
          Iniciar Sesión
        </Link>
        <Link 
          to="/register" 
          className="bg-[#2563EB] text-white text-[16px] font-bold px-[32px] py-[12px] rounded-[8px] flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-md"
        >
          Empezar Gratis
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;