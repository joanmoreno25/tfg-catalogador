import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase-config';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import { s3Client, BUCKET_NAME } from '../aws-config';
import { PutObjectCommand } from "@aws-sdk/client-s3";

const Profile = () => {
  const { t, i18n } = useTranslation();
  const { currentUser } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [language, setLanguage] = useState(localStorage.getItem('appLanguage') || 'es');
  
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');

  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(currentUser?.photoURL || "https://ui-avatars.com/api/?name=" + (currentUser?.displayName || currentUser?.email || "User") + "&background=E2E8F0&color=2563EB");

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const todayDate = new Date().toLocaleDateString(i18n.language, { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  useEffect(() => {
    const loadUserData = async () => {
      if (currentUser) {
        const docRef = doc(db, "usuarios", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPhone(data.phone || '');
          setAddress(data.address || '');
          setPostalCode(data.postalCode || '');
          setCountry(data.country || '');
          setBirthDate(data.birthDate || '');
          if (data.language) setLanguage(data.language);
        }
      }
    };
    loadUserData();
  }, [currentUser]);

  const handlePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedPhoto(e.target.files[0]);
      setPhotoPreview(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      localStorage.setItem('appLanguage', language);
      i18n.changeLanguage(language); 

      let newPhotoUrl = currentUser.photoURL;

      if (selectedPhoto) {
        // 1. Validación estricta de seguridad (MIME Type)
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(selectedPhoto.type)) {
          alert("Por favor, selecciona una imagen válida (JPG, PNG, WEBP).");
          setIsLoading(false);
          return; 
        }

        // 2. UUID ligado al usuario para evitar colisiones
        const uniqueId = crypto.randomUUID().split('-')[0];
        const safeFileName = `${currentUser.uid}_avatar_${uniqueId}_${selectedPhoto.name.replace(/\s+/g, '_')}`;
        
        const arrayBuffer = await selectedPhoto.arrayBuffer();
        const fileData = new Uint8Array(arrayBuffer);

        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `avatars/${safeFileName}`,
          Body: fileData,
          ContentType: selectedPhoto.type
        }));

        newPhotoUrl = `https://${BUCKET_NAME}.s3.eu-south-2.amazonaws.com/avatars/${safeFileName}`;
      }

      await setDoc(doc(db, "usuarios", currentUser.uid), {
        phone,
        address,
        postalCode,
        country,
        birthDate,
        language,
        photoURL: newPhotoUrl
      }, { merge: true });

      if (newPassword) {
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
          setIsLoading(false);
          return setErrorMsg(t('profile.error_password_regex'));
        }

        if (!currentPassword) {
          setIsLoading(false);
          return setErrorMsg(t('profile.error_current_password_required'));
        }
        if (newPassword !== confirmPassword) {
          setIsLoading(false);
          return setErrorMsg(t('profile.error_passwords_not_match'));
        }

        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
      }

      setSuccessMsg(t('profile.success_profile_updated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setErrorMsg(t('profile.error_wrong_password'));
      } else {
        setErrorMsg(t('profile.error_update_profile'));
        console.error(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      setErrorMsg(t('profile.error_logout'));
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteUser(currentUser);
      navigate('/register');
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        setShowDeleteModal(false);
        setErrorMsg(t('profile.error_requires_recent_login'));
      } else {
        setShowDeleteModal(false);
        setErrorMsg(t('profile.error_delete_account'));
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-[#EEF2F6] dark:bg-[#0B1120] relative p-4 sm:p-8 font-sans overflow-hidden transition-colors duration-300">
      
      <div className="w-full max-w-[1100px] flex justify-start mb-6 z-10 relative mt-4">
        <button 
          onClick={() => navigate('/dashboard')} 
          className="text-[#475569] dark:text-slate-200 text-[16px] font-bold px-5 py-2.5 rounded-[10px] bg-white dark:bg-[#1E293B] hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm transition-all flex items-center gap-2 border border-slate-200 dark:border-slate-700"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          {t('profile.back_dashboard')}
        </button>
      </div>

      <div className="relative z-10 w-full max-w-[1100px] bg-white dark:bg-[#1E293B] rounded-[24px] shadow-xl p-8 md:p-14 mb-10 border border-slate-100 dark:border-slate-700 transition-colors duration-300">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-6 border-b border-[#E2E8F0] dark:border-slate-700 gap-6">
          <div className="flex items-center gap-5">
            <img 
              src={photoPreview} 
              alt="Avatar" 
              className="w-20 h-20 rounded-full object-cover border-[3px] border-gray-100 dark:border-slate-600 shadow-md"
            />
            <div>
              <h1 className="text-[#0F172A] dark:text-white text-[28px] md:text-[36px] font-extrabold leading-tight">
                {t('profile.welcome')}<span className="text-[#3B82F6]">{currentUser?.displayName || t('profile.user')}</span>!
              </h1>
              <p className="text-[#64748B] dark:text-slate-400 text-[16px] font-medium capitalize mt-1">
                {todayDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-700">
            {isDarkMode ? (
              <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            ) : (
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
            )}
            <button 
              type="button"
              onClick={toggleDarkMode} 
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center shadow-inner ${isDarkMode ? 'bg-[#3B82F6]' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span className={`w-4 h-4 bg-white rounded-full absolute shadow-sm transition-transform duration-300 ease-in-out ${isDarkMode ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-[10px] text-[15px] font-medium flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-8 p-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-[10px] text-[15px] font-medium flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            {successMsg}
          </div>
        )}

        <div className="flex items-center gap-6 mb-10">
          <input type="file" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" accept="image/*" />
          <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800 px-5 py-3 rounded-[12px] border border-slate-100 dark:border-slate-700">
            <button type="button" onClick={() => fileInputRef.current.click()} className="text-[#3B82F6] font-semibold text-[15px] text-left hover:text-[#2563EB] flex items-center gap-2 transition-colors">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              {t('profile.change_photo')}
            </button>
          </div>
        </div>

        <form onSubmit={handleUpdate}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-14 gap-y-10">
            
            <div className="flex flex-col gap-6">
              <h2 className="text-[#0F172A] dark:text-white text-[20px] font-extrabold border-b border-gray-100 dark:border-slate-700 pb-3 flex items-center gap-2">
                <svg width="22" height="22" fill="none" stroke="#3B82F6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                {t('profile.personal_data')}
              </h2>
              
              <div>
                <label className="block text-[#475569] dark:text-slate-300 text-[14px] font-bold mb-2">{t('profile.fullname')}</label>
                <input 
                  type="text" 
                  value={currentUser?.displayName || ''}
                  disabled
                  className="w-full bg-gray-50 dark:bg-slate-800/50 border border-[#E2E8F0] dark:border-slate-700 text-gray-500 dark:text-slate-400 text-[15px] font-medium rounded-[10px] px-4 py-3.5 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[#475569] dark:text-slate-300 text-[14px] font-bold mb-2">{t('profile.email')}</label>
                <input 
                  type="email" 
                  value={currentUser?.email || ''}
                  disabled
                  className="w-full bg-gray-50 dark:bg-slate-800/50 border border-[#E2E8F0] dark:border-slate-700 text-gray-500 dark:text-slate-400 text-[15px] font-medium rounded-[10px] px-4 py-3.5 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#475569] dark:text-slate-300 text-[14px] font-bold mb-2">{t('profile.phone')}</label>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('profile.phone_placeholder')}
                    className="w-full bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-600 text-[#0F172A] dark:text-white text-[15px] font-medium rounded-[10px] px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all placeholder:text-[#94A3B8] dark:placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-[#475569] dark:text-slate-300 text-[14px] font-bold mb-2">{t('profile.birthdate')}</label>
                  <input 
                    type="date" 
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-600 text-[#0F172A] dark:text-white text-[15px] font-medium rounded-[10px] px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#475569] dark:text-slate-300 text-[14px] font-bold mb-2">{t('profile.language')}</label>
                <div className="relative">
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-600 text-[#0F172A] dark:text-white text-[15px] font-medium rounded-[10px] px-4 py-3.5 appearance-none focus:outline-none focus:ring-1 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all cursor-pointer"
                  >
                    <option value="es">{t('profile.lang_es')}</option>
                    <option value="en">{t('profile.lang_en')}</option>
                    <option value="fr">{t('profile.lang_fr')}</option>
                    <option value="it">{t('profile.lang_it')}</option>
                    <option value="de">{t('profile.lang_de')}</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-slate-500">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7-7-7-7"></path></svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <h2 className="text-[#0F172A] dark:text-white text-[20px] font-extrabold border-b border-gray-100 dark:border-slate-700 pb-3 flex items-center gap-2">
                <svg width="22" height="22" fill="none" stroke="#3B82F6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                {t('profile.location')}
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[#475569] dark:text-slate-300 text-[14px] font-bold mb-2">{t('profile.address')}</label>
                  <input 
                    type="text" 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t('profile.address_placeholder')}
                    className="w-full bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-600 text-[#0F172A] dark:text-white text-[15px] font-medium rounded-[10px] px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all placeholder:text-[#94A3B8] dark:placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-[#475569] dark:text-slate-300 text-[14px] font-bold mb-2">{t('profile.country')}</label>
                  <input 
                    type="text" 
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder={t('profile.country_placeholder')}
                    className="w-full bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-600 text-[#0F172A] dark:text-white text-[15px] font-medium rounded-[10px] px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all placeholder:text-[#94A3B8] dark:placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-[#475569] dark:text-slate-300 text-[14px] font-bold mb-2">{t('profile.postal_code')}</label>
                  <input 
                    type="text" 
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder={t('profile.postal_code_placeholder')}
                    className="w-full bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-600 text-[#0F172A] dark:text-white text-[15px] font-medium rounded-[10px] px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all placeholder:text-[#94A3B8] dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <h2 className="text-[#0F172A] dark:text-white text-[20px] font-extrabold border-b border-gray-100 dark:border-slate-700 pb-3 mt-2 flex items-center gap-2">
                <svg width="22" height="22" fill="none" stroke="#3B82F6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                {t('profile.security')}
              </h2>
              
              <div>
                <label className="block text-[#475569] dark:text-slate-300 text-[14px] font-bold mb-2">{t('profile.current_password')}</label>
                <div className="relative">
                  <input 
                    type={showCurrentPassword ? "text" : "password"} 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="********"
                    className="w-full bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-600 text-[#0F172A] dark:text-white text-[15px] font-medium rounded-[10px] px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all placeholder:text-[#94A3B8] dark:placeholder:text-slate-500"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-slate-500 hover:text-[#0F172A] dark:hover:text-white transition-colors"
                  >
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showCurrentPassword 
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                      }
                    </svg>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#475569] dark:text-slate-300 text-[14px] font-bold mb-2">{t('profile.new_password')}</label>
                  <div className="relative">
                    <input 
                      type={showNewPassword ? "text" : "password"} 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="********"
                      className="w-full bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-600 text-[#0F172A] dark:text-white text-[15px] font-medium rounded-[10px] px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all placeholder:text-[#94A3B8] dark:placeholder:text-slate-500"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-slate-500 hover:text-[#0F172A] dark:hover:text-white transition-colors"
                    >
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {showNewPassword 
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                        }
                      </svg>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[#475569] dark:text-slate-300 text-[14px] font-bold mb-2">{t('profile.confirm_password')}</label>
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="********"
                      className="w-full bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-600 text-[#0F172A] dark:text-white text-[15px] font-medium rounded-[10px] px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3B82F6] focus:border-[#3B82F6] transition-all placeholder:text-[#94A3B8] dark:placeholder:text-slate-500"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-slate-500 hover:text-[#0F172A] dark:hover:text-white transition-colors"
                    >
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {showConfirmPassword 
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                        }
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-700 pt-8">
            <button 
              type="button"
              onClick={handleLogout}
              className="w-full text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 font-semibold text-[16px] px-8 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-red-600 dark:hover:text-red-400 rounded-[12px] transition-colors shadow-sm border border-slate-200 dark:border-slate-700"
            >
              {t('profile.logout')}
            </button>
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-[#2563EB] text-white text-[16px] font-semibold px-12 py-4 rounded-[12px] hover:bg-[#1D4ED8] hover:shadow-md transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {isLoading ? t('profile.saving') : t('profile.save_changes')}
            </button>
          </div>
        </form>

        <div className="mt-8 flex justify-center">
          <button 
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 font-medium text-[14px] transition-colors underline"
          >
            {t('profile.delete_account')}
          </button>
        </div>

      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all">
          <div className="bg-white dark:bg-[#1E293B] rounded-[24px] shadow-2xl max-w-[480px] w-full p-8 md:p-10 transform scale-100 animate-in fade-in zoom-in duration-200 border border-slate-100 dark:border-slate-700">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 className="text-[#0F172A] dark:text-white text-[24px] font-extrabold mb-3">{t('profile.modal_delete_title')}</h3>
            <p className="text-[#64748B] dark:text-slate-400 text-[15px] mb-8 leading-relaxed font-medium">
              {t('profile.modal_delete_text_1')}<span className="font-bold text-[#0F172A] dark:text-white">{t('profile.modal_delete_text_2')}</span>{t('profile.modal_delete_text_3')}
            </p>
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="w-full sm:w-auto px-6 py-3.5 text-[#475569] dark:text-slate-200 font-bold bg-slate-100 dark:bg-slate-700 rounded-[10px] hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                {t('profile.cancel')}
              </button>
              <button 
                onClick={handleDeleteAccount}
                className="w-full sm:w-auto px-6 py-3.5 text-white font-bold bg-red-600 rounded-[10px] hover:bg-red-700 shadow-md transition-all"
              >
                {t('profile.confirm_delete')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Profile;