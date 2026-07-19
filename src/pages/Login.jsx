import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase-config'; 
import { Helmet } from 'react-helmet-async';

import logo from '../assets/logo-v2.png'; 
import loginImage from '../assets/login-image.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async (e) => {
    e.preventDefault();
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/dashboard'); 
    } catch (error) {
      setErrorMsg("Error al iniciar sesión con Google.");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      return setErrorMsg("Todos los campos son obligatorios.");
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard');
    } catch (error) {
      setErrorMsg("Correo o contraseña incorrectos. Inténtalo de nuevo.");
    }
  };

  return (
    <>
      <Helmet>
        <title>Iniciar Sesión | AdVision</title>
        <meta name="description" content="Inicia sesión en tu cuenta de AdVision para gestionar y analizar tus archivos publicitarios con IA." />
      </Helmet>

      <div className="min-h-screen flex w-full font-sans bg-white">
        
        {/* MITAD IZQUIERDA: Formulario */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center px-[8%] sm:px-[12%] lg:px-[15%] py-12">
          
          <div className="flex flex-col items-center mb-10 mt-4">
            <img src={logo} alt="AdVision Logo" className="w-20 h-20 object-contain mb-4" />
            <h1 className="text-[#0F172A] text-[40px] font-extrabold mb-2 text-center leading-[1.1]">Bienvenido de nuevo</h1>
            <p className="text-[#64748B] text-[18px] text-center">Introduce tus credenciales para acceder</p>
          </div>

          <button 
            onClick={handleGoogleSignIn}
            type="button"
            className="w-full flex items-center justify-center gap-3 bg-white border border-[#E2E8F0] text-[#0F172A] text-[18px] rounded-[10px] px-4 py-3.5 hover:bg-gray-50 transition-colors font-semibold shadow-sm mb-6"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-[#E2E8F0]"></div>
            <span className="text-[#94A3B8] text-[16px] font-medium">o continuar con el email</span>
            <div className="flex-1 h-px bg-[#E2E8F0]"></div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-100 text-red-600 border border-red-200 rounded-[8px] text-[14px] text-center font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="block text-[#0F172A] text-[16px] font-semibold mb-2">Correo electrónico</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ana.garcia@ejemplo.com"
                className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-[16px] rounded-[10px] px-4 py-3.5 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors placeholder:text-[#94A3B8]"
              />
            </div>

            <div>
              <label className="block text-[#0F172A] text-[16px] font-semibold mb-2">Contraseña</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-[16px] rounded-[10px] px-4 py-3.5 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors placeholder:text-[#94A3B8]"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] text-[15px] font-medium"
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              
              {/* Link "¿Has olvidado tu contraseña?" */}
              <div className="flex justify-end mt-2">
                <Link to="/forgot-password" className="text-[#2563EB] text-[14px] font-medium hover:underline">
                  ¿Has olvidado tu contraseña?
                </Link>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full bg-[#2563EB] text-white text-[18px] font-bold px-4 py-4 rounded-[10px] hover:bg-blue-700 transition-colors mt-2 shadow-md active:scale-[0.98]"
            >
              Iniciar Sesión
            </button>
          </form>

          <p className="text-center text-[#64748B] text-[16px] mt-8">
            ¿No tienes cuenta? <Link to="/register" className="text-[#2563EB] font-semibold hover:underline">Regístrate</Link>
          </p>

        </div>

        {/* MITAD DERECHA */}
        <div className="hidden lg:flex flex-col lg:w-1/2 bg-[#2563EB] relative items-center justify-center p-12 overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent z-0"></div>
          
          <img 
            src={loginImage} 
            alt="Login Mockup" 
            className="relative z-10 w-[95%] max-w-[700px] object-contain mb-10 drop-shadow-2xl transition-transform duration-500 hover:scale-[1.03]" 
          />
          
          <h2 className="relative z-10 text-white text-[38px] xl:text-[42px] font-extrabold tracking-tight text-center leading-[1.1] mb-3">
            Conéctate con cualquier dispositivo
          </h2>
          <p className="relative z-10 text-white/90 text-[18px] xl:text-[20px] text-center font-medium">
            Lo único que necesitas es conexión a internet.
          </p>
        </div>

      </div>
    </>
  );
};

export default Login;