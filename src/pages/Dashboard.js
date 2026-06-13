import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { s3Client, rekognitionClient, BUCKET_NAME } from '../aws-config';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { DetectLabelsCommand, DetectTextCommand } from "@aws-sdk/client-rekognition";

import { db, auth } from '../firebase-config'; 
import { signOut } from "firebase/auth"; 
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, where } from "firebase/firestore";
import { useAuth } from '../context/AuthContext';

import logo from '../assets/logo.svg';

function Dashboard() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isDragging, setIsDragging] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const fileInputRef = useRef(null);
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const fetchHistory = async () => {
    if (!currentUser) return;
    try {
      const q = query(
        collection(db, "analisis"),
        where("userId", "==", currentUser.uid),
        orderBy("fechaCreacion", "desc")
      );
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHistory(docs);
    } catch (error) {
      console.error("Error al cargar historial:", error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files.length > 0) {
      setFiles(Array.from(event.target.files));
    }
  };

  const translateLabel = async (text, targetLang) => {
    if (targetLang === 'en') return text; 
    
    try {
      const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`);
      const data = await response.json();
      return data.responseData.translatedText || text;
    } catch (e) {
      console.error("Error al traducir:", e);
      return text;
    }
  };

  const saveToFirestore = async (imageName, translatedLabels, detectedText) => {
    try {
      const analysisData = {
        userId: currentUser.uid,
        nombreImagen: imageName,
        etiquetas: translatedLabels,
        textoDetectado: detectedText.map(t => t.DetectedText),
        fechaCreacion: serverTimestamp()
      };
      await addDoc(collection(db, "analisis"), analysisData);
      fetchHistory();
    } catch (error) {
      console.error("Error al guardar:", error);
    }
  };

  const analyzeImage = async (imageName, fileData) => {
    try {
      const imageParams = { Image: { Bytes: fileData } };

      const labelsCommand = new DetectLabelsCommand({
        ...imageParams,
        MaxLabels: 5,
        MinConfidence: 75,
      });

      const textCommand = new DetectTextCommand(imageParams);

      const [labelsResponse, textResponse] = await Promise.all([
        rekognitionClient.send(labelsCommand),
        rekognitionClient.send(textCommand)
      ]);

      const textLines = textResponse.TextDetections.filter(item => item.Type === 'LINE');

      const targetLang = localStorage.getItem('appLanguage') || 'es';

      const translatedLabels = await Promise.all(
        labelsResponse.Labels.map(async (label) => {
          const translatedName = await translateLabel(label.Name, targetLang);
          return {
            nombre: translatedName,
            confianza: label.Confidence
          };
        })
      );

      await saveToFirestore(imageName, translatedLabels, textLines);
    } catch (error) {
      console.error("ERROR DETALLADO AWS:", error);
    }
  };

  const uploadToS3 = async () => {
    if (files.length === 0) return alert("Selecciona al menos un archivo primero");
    setUploading(true);
   
    try {
      const uploadPromises = files.map(async (file) => {
        const safeFileName = file.name.replace(/\s+/g, '_');
        const arrayBuffer = await file.arrayBuffer();
        const fileData = new Uint8Array(arrayBuffer);
       
        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `originals/${safeFileName}`,
          Body: fileData,
          ContentType: file.type
        }));
       
        await analyzeImage(safeFileName, fileData);
      });

      await Promise.all(uploadPromises);
      setFiles([]); 
     
    } catch (error) {
      console.error("Fallo general:", error);
    } finally {
      setUploading(false);
    }
  };

  const filteredHistory = history.filter(item => {
    if (!searchTerm) return true;
    
    const term = searchTerm.toLowerCase();
    
    const matchName = item.nombreImagen?.toLowerCase().includes(term);
    const matchLabel = item.etiquetas?.some(label => label.nombre.toLowerCase().includes(term));
    const matchText = item.textoDetectado?.some(txt => txt.toLowerCase().includes(term));
    
    return matchName || matchLabel || matchText;
  });

  return (
    <div className="min-h-screen bg-[#EEF2F6] font-sans pb-20 relative">
      
      <div className="w-full bg-[#0F172A] pt-6 pb-16 relative shadow-lg">
        
        <div className="absolute top-6 right-8 z-50">
          <div className="relative">
            <img 
              onClick={() => setDropdownOpen(!dropdownOpen)} 
              src={currentUser?.photoURL || "https://ui-avatars.com/api/?name=" + (currentUser?.email || "User") + "&background=64748B&color=fff"} 
              alt="Perfil" 
              className="w-16 h-16 rounded-full cursor-pointer border-[3px] border-transparent hover:border-[#3B82F6] transition-all object-cover shadow-md"
            />
            
            {dropdownOpen && (
              <div className="absolute right-0 mt-3 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-100 mb-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">{currentUser?.displayName || 'Usuario'}</p>
                  <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
                </div>
                <button 
                  onClick={() => { setDropdownOpen(false); navigate('/profile'); }} 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Editar Perfil
                </button>
                <button 
                  onClick={handleLogout} 
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                >
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pt-14 pb-8 flex flex-col items-center text-center px-4">
          <div className="flex items-center justify-center gap-4 mb-2">
            <img src={logo} alt="AdVision Logo" className="w-14 h-14 object-contain drop-shadow-md" />
            <h1 className="text-[46px] md:text-[56px] font-extrabold tracking-tight drop-shadow-md">
              <span className="text-white">Ad</span>
              <span className="text-[#3B82F6]">Vision</span>
            </h1>
          </div>
          <p className="text-[#94A3B8] text-[20px] md:text-[24px] font-medium mt-2">
            Análisis Avanzado de Piezas Publicitarias
          </p>
          <div className="w-[400px] h-px bg-slate-700 mt-8"></div>
        </div>

        <div className="max-w-[800px] mx-auto px-6 flex flex-col items-center mt-6">
          <div 
            className={`w-full border-2 border-dashed rounded-[24px] py-16 flex flex-col justify-center items-center cursor-pointer transition-all backdrop-blur-sm shadow-2xl ${
              isDragging 
                ? 'border-[#3B82F6] bg-[#3B82F6]/10' 
                : 'border-slate-600 bg-slate-800/50 hover:border-[#3B82F6] hover:bg-slate-800/80'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange} 
              accept="image/*"
              multiple 
            />
            
            <svg className="w-16 h-16 text-[#3B82F6] mb-6 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>

            {files.length > 0 ? (
              <div className="flex flex-col items-center px-4">
                <p className="text-white font-medium text-[20px] mb-3">
                  <span className="text-[#3B82F6]">{files.length}</span> {files.length === 1 ? 'archivo seleccionado' : 'archivos seleccionados'}
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {files.slice(0, 3).map((f, i) => (
                    <span key={i} className="text-white text-[14px] bg-slate-700 px-3 py-1.5 rounded-md truncate max-w-[150px]">
                      {f.name}
                    </span>
                  ))}
                  {files.length > 3 && (
                    <span className="text-slate-400 text-[14px] px-2 py-1.5 font-medium">
                      + {files.length - 3} más
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-slate-300 text-[20px] md:text-[22px] font-medium text-center px-4">
                Arrastre los archivos aquí o <span className="text-[#3B82F6] font-bold hover:underline hover:text-blue-400 transition-colors">navegue</span>
              </p>
            )}
          </div>

          <button 
            onClick={uploadToS3} 
            disabled={uploading || files.length === 0}
            className="mt-8 bg-[#0052FF] text-white text-[20px] font-bold px-14 py-4 rounded-[10px] hover:bg-[#003BCC] hover:scale-105 hover:shadow-[0_10px_25px_rgba(0,82,255,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none flex items-center justify-center min-w-[240px]"
          >
            {uploading ? 'Procesando...' : 'Procesar con IA'}
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 mt-16">
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
          <div className="flex items-center gap-4">
            <h2 className="text-[#0F172A] text-[34px] md:text-[38px] font-extrabold tracking-tight">
              Banco de Imágenes
            </h2>
            <span className="bg-[#6D28D9] text-white text-[16px] font-bold px-4 py-1.5 rounded-full shadow-sm">
              {filteredHistory.length} registros
            </span>
          </div>
          
          <div className="relative w-full md:w-[600px]">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Buscar por etiquetas, nombre de archivo o texto de la imagen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white text-[#475569] text-[16px] font-medium border border-transparent pl-12 pr-4 py-4 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] shadow-sm placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {filteredHistory.map((item) => (
            <article key={item.id} className="bg-white rounded-[16px] shadow-sm overflow-hidden flex flex-col border border-gray-100 transition-transform hover:-translate-y-2 hover:shadow-xl">
              
              <div className="w-full h-[280px] bg-gray-100 overflow-hidden relative">
                <img
                  src={`https://${BUCKET_NAME}.s3.eu-south-2.amazonaws.com/originals/${item.nombreImagen}`}
                  alt={item.nombreImagen}
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="p-6 flex-1 flex flex-col">
                <div className="mb-5">
                  <p className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Nombre del archivo</p>
                  <h3 className="text-[#0F172A] text-[16px] font-bold truncate" title={item.nombreImagen}>
                    {item.nombreImagen}
                  </h3>
                </div>
                
                <div className="flex flex-col flex-1">
                  <p className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-3">Etiquetas</p>
                  <div className="flex flex-col gap-3">
                    {item.etiquetas?.slice(0, 5).map((label, i) => (
                      <div key={i} className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[13px] font-bold text-[#0F172A]">
                          <span className="capitalize">{label.nombre}</span>
                          <span className="text-gray-500">{label.confianza.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${label.confianza}%`,
                              backgroundColor: label.confianza > 95 ? '#10b981' : label.confianza > 85 ? '#3B82F6' : '#f59e0b'
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {item.textoDetectado && item.textoDetectado.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <p className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Texto detectado</p>
                    <div className="flex flex-wrap gap-2">
                       {item.textoDetectado.slice(0, 3).map((txt, idx) => (
                          <span key={idx} className="bg-blue-50 text-blue-700 border border-blue-100 text-[12px] px-2.5 py-1 rounded-md font-medium">"{txt}"</span>
                       ))}
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

      </div>
    </div>
  );
}

export default Dashboard;