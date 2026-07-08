import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

import { s3Client, rekognitionClient, BUCKET_NAME } from '../aws-config';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { DetectLabelsCommand, DetectTextCommand, DetectModerationLabelsCommand } from "@aws-sdk/client-rekognition";
import { comprehendClient } from '../aws-config';
import { DetectSentimentCommand } from "@aws-sdk/client-comprehend";

import { db, auth } from '../firebase-config'; 
import { signOut } from "firebase/auth"; 
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, where, limit, startAfter, getCountFromServer } from "firebase/firestore";
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import logo from '../assets/logo.svg';

function Dashboard() {
  const { t, i18n } = useTranslation();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [dateFilter, setDateFilter] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const fileInputRef = useRef(null);
  
  const [lastVisible, setLastVisible] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [revealedImages, setRevealedImages] = useState({});
  const [revealedReasons, setRevealedReasons] = useState({});
  const observer = useRef();

  const { currentUser } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();

  const cleanFileName = (name) => {
    if (!name) return '';
    return name.replace(/^[0-9]+_[a-zA-Z0-9]+_/, '');
  };

  const fetchHistory = useCallback(async () => {
    if (!currentUser) return;
    try {
      const countQuery = query(collection(db, "analisis"), where("userId", "==", currentUser.uid));
      const snapshot = await getCountFromServer(countQuery);
      setTotalRecords(snapshot.data().count);

      const q = query(
        collection(db, "analisis"),
        where("userId", "==", currentUser.uid),
        orderBy("fechaCreacion", "desc"),
        limit(15)
      );
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHistory(docs);
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
      setHasMore(querySnapshot.docs.length === 15);
    } catch (error) {
      console.error("Error al cargar historial:", error);
    }
  }, [currentUser]);

  const fetchMoreHistory = useCallback(async () => {
    if (!currentUser || !lastVisible || !hasMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, "analisis"),
        where("userId", "==", currentUser.uid),
        orderBy("fechaCreacion", "desc"),
        startAfter(lastVisible),
        limit(15)
      );
      const querySnapshot = await getDocs(q);
      const newDocs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setHistory(prev => {
        const existingIds = new Set(prev.map(item => item.id));
        const uniqueNewDocs = newDocs.filter(doc => !existingIds.has(doc.id));
        return [...prev, ...uniqueNewDocs];
      });
      
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
      setHasMore(querySnapshot.docs.length === 15);
    } catch (error) {
      console.error("Error al cargar más historial:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [currentUser, lastVisible, hasMore]);

  const lastImageElementRef = useCallback(node => {
    if (loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchMoreHistory();
      }
    });
    if (node) observer.current.observe(node);
  }, [loadingMore, hasMore, fetchMoreHistory]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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

  const saveToFirestore = async (imageName, translatedLabels, detectedText, dominantColors, moderationLabels, sentiment) => {
    try {
      const analysisData = {
        userId: currentUser.uid,
        nombreImagen: imageName,
        etiquetas: translatedLabels,
        textoDetectado: detectedText.map(t => t.DetectedText),
        coloresDominantes: dominantColors || [],
        moderacion: moderationLabels || [],
        sentimiento: sentiment || null, // Nuevo campo
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
        Features: ["GENERAL_LABELS", "IMAGE_PROPERTIES"] 
      });
      const textCommand = new DetectTextCommand(imageParams);
      const moderationCommand = new DetectModerationLabelsCommand({
        ...imageParams,
        MinConfidence: 60
      });

      const [labelsResponse, textResponse, moderationResponse] = await Promise.all([
        rekognitionClient.send(labelsCommand),
        rekognitionClient.send(textCommand),
        rekognitionClient.send(moderationCommand)
      ]);

      const textLines = textResponse.TextDetections.filter(item => item.Type === 'LINE');
      const targetLangs = ['es', 'fr', 'it', 'de'];

      const multilangLabels = await Promise.all(
        labelsResponse.Labels.map(async (label) => {
          const nombresDict = { en: label.Name };
          await Promise.all(targetLangs.map(async (lang) => {
             nombresDict[lang] = await translateLabel(label.Name, lang);
          }));
          return {
            nombres: nombresDict,
            confianza: label.Confidence,
            nombre: nombresDict['es'] 
          };
        })
      );

      let dominantColors = [];
      if (labelsResponse.ImageProperties && labelsResponse.ImageProperties.DominantColors) {
        dominantColors = labelsResponse.ImageProperties.DominantColors
          .slice(0, 3) 
          .map(color => color.HexCode); 
      }

      const multilangModeration = await Promise.all(
        moderationResponse.ModerationLabels.map(async (mod) => {
          const nombresDict = { en: mod.Name };
          await Promise.all(targetLangs.map(async (lang) => {
             nombresDict[lang] = await translateLabel(mod.Name, lang);
          }));
          return {
            nombres: nombresDict,
            confianza: mod.Confidence,
            nombre: nombresDict['es'] 
          };
        })
      );

      // --- ANÁLISIS DE SENTIMIENTO (NLP) ---
      const detectedString = textLines.map(t => t.DetectedText).join(" ");
      let sentimentResult = null;
      
      if (detectedString.trim().length > 0) {
        try {
          const sentimentCommand = new DetectSentimentCommand({
            LanguageCode: "es",
            Text: detectedString.substring(0, 4900)
          });
          const sentimentResponse = await comprehendClient.send(sentimentCommand);
          sentimentResult = sentimentResponse.Sentiment;
        } catch (e) {
          console.error("Error en AWS Comprehend NLP:", e);
        }
      }

    await saveToFirestore(imageName, multilangLabels, textLines, dominantColors, multilangModeration, sentimentResult);    } catch (error) {
      console.error("ERROR DETALLADO AWS:", error);
    }
  };

  const createThumbnail = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400; // Ancho optimizado para la galería
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            resolve(blob);
          }, file.type);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadToS3 = async () => {
    if (files.length === 0) return alert(t('dashboard.alert_select_file'));
    setUploading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        // 1. Validación estricta de MIME Type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          alert(`Archivo bloqueado: ${file.name} no es un formato seguro.`);
          return; 
        }

        // 2. Prevención de colisiones con UUID
        const uniqueId = crypto.randomUUID().split('-')[0];
        const safeFileName = `${Date.now()}_${uniqueId}_${file.name.replace(/\s+/g, '_')}`;
        
        const arrayBuffer = await file.arrayBuffer();
        const fileData = new Uint8Array(arrayBuffer);
       
        // Subida segura con credenciales temporales
        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `originals/${safeFileName}`,
          Body: fileData,
          ContentType: file.type
        }));
       
        // Generación y subida de miniatura
        try {
          const thumbnailBlob = await createThumbnail(file);
          const thumbArrayBuffer = await thumbnailBlob.arrayBuffer();
          const thumbData = new Uint8Array(thumbArrayBuffer);

          await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: `thumbnails/${safeFileName}`,
            Body: thumbData,
            ContentType: file.type
          }));
        } catch (thumbError) {
          console.error("Error al procesar miniatura:", thumbError);
        }

        // Análisis en AWS Rekognition
        await analyzeImage(safeFileName, fileData);
      });
      
      await Promise.all(uploadPromises);
      setFiles([]); 
    } catch (error) {
      console.error("Fallo general en la subida:", error);
    } finally {
      setUploading(false);
    }
  };

  const exportToPDF = async (item, elementId) => {
    const originalElement = document.getElementById(elementId);
    if (!originalElement) return;

    const clonedElement = originalElement.cloneNode(true);
    clonedElement.style.width = '800px'; 
    clonedElement.style.position = 'absolute';
    clonedElement.style.left = '-9999px'; 
    clonedElement.style.height = 'auto'; 
    clonedElement.className = "bg-white p-8 flex flex-col"; 
    
    const titleElement = clonedElement.querySelector('h3');
    if (titleElement) {
      titleElement.className = "text-[#0F172A] text-[20px] font-bold mb-4"; 
      titleElement.innerText = item.nombreImagen; 
    }

    const tagsContainer = clonedElement.querySelectorAll('.flex.flex-col.gap-3')[0];
    if (tagsContainer && item.etiquetas) {
      tagsContainer.innerHTML = ''; 
      item.etiquetas.forEach(label => {
        const currentLang = i18n.language || 'es';
        const displayName = label.nombres ? label.nombres[currentLang] : label.nombre;
        const color = label.confianza > 95 ? '#10b981' : label.confianza > 85 ? '#3B82F6' : '#f59e0b';
        
        tagsContainer.innerHTML += `
          <div class="flex flex-col gap-1.5 mb-2">
            <div class="flex justify-between items-center text-[14px] font-bold text-[#0F172A]">
              <span class="capitalize">${displayName}</span>
              <span class="text-gray-500">${label.confianza.toFixed(1)}%</span>
            </div>
            <div class="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div class="h-full rounded-full" style="width: ${label.confianza}%; background-color: ${color}"></div>
            </div>
          </div>
        `;
      });
    }

    const textContainerWrapper = clonedElement.querySelector('.mt-5.pt-4.border-t');
    if (textContainerWrapper && item.textoDetectado && item.textoDetectado.length > 0) {
      const textContainer = textContainerWrapper.querySelector('.flex.flex-wrap.gap-2');
      if (textContainer) {
        textContainer.innerHTML = ''; 
        item.textoDetectado.forEach(txt => {
          textContainer.innerHTML += `<span class="bg-blue-50 text-blue-700 border border-blue-100 text-[13px] px-3 py-1.5 rounded-md font-medium mb-1">"${txt}"</span>`;
        });
      }
    }

    const btn = clonedElement.querySelector('button');
    if (btn) btn.remove();

    document.body.appendChild(clonedElement);

    try {
      const canvas = await html2canvas(clonedElement, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const finalHeight = pdfHeight > pdf.internal.pageSize.getHeight() ? pdf.internal.pageSize.getHeight() : pdfHeight;
      const finalWidth = pdfHeight > pdf.internal.pageSize.getHeight() ? (canvas.width * finalHeight) / canvas.height : pdfWidth;

      pdf.addImage(imgData, 'PNG', (pdfWidth - finalWidth) / 2, 0, finalWidth, finalHeight);
      pdf.save(`AdVision_Report_${item.nombreImagen.replace(/\.[^/.]+$/, "")}.pdf`);
    } catch (error) {
      console.error("Error generando PDF:", error);
    } finally {
      document.body.removeChild(clonedElement);
    }
  };

  const uniqueTags = Array.from(new Set(
    history.flatMap(item => item.etiquetas?.map(e => e.nombres ? e.nombres[i18n.language || 'es'] : e.nombre) || [])
  )).filter(Boolean);

  const filteredHistory = history.filter(item => {
    const term = searchTerm.toLowerCase();
    const currentLang = i18n.language || 'es';
    
    const matchName = item.nombreImagen?.toLowerCase().includes(term);
    const matchLabel = item.etiquetas?.some(label => {
      const labelText = label.nombres ? label.nombres[currentLang] : label.nombre;
      return labelText?.toLowerCase().includes(term);
    });
    const matchText = item.textoDetectado?.some(txt => txt.toLowerCase().includes(term));
    const passesSearch = term === '' || matchName || matchLabel || matchText;

    const passesConfidence = confidenceFilter === 0 || (item.etiquetas && item.etiquetas.some(label => {
      if (confidenceFilter === 95) return label.confianza <= 95;
      if (confidenceFilter === 90) return label.confianza <= 90;
      return true;
    }));

    let passesDate = true;
    if (dateFilter !== 'all' && item.fechaCreacion) {
      const itemDate = item.fechaCreacion.toDate();
      const now = new Date();
      const diffTime = Math.abs(now - itemDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (dateFilter === 'today') passesDate = diffDays <= 1;
      if (dateFilter === 'week') passesDate = diffDays <= 7;
      if (dateFilter === 'month') passesDate = diffDays <= 30;
    }

    return passesSearch && passesConfidence && passesDate;
  });

  const exportToCSV = () => {
    const currentLang = i18n.language || 'es';
    const headers = ["Archivo", "Etiquetas", "Texto Detectado"];
    const rows = filteredHistory.map(item => {
      const tags = item.etiquetas ? item.etiquetas.map(e => {
        const name = e.nombres ? e.nombres[currentLang] : e.nombre;
        return `${name} (${e.confianza.toFixed(1)}%)`;
      }).join(" - ") : "";
      const texts = item.textoDetectado ? item.textoDetectado.join(" | ") : "";
      return `"${item.nombreImagen}","${tags}","${texts}"`;
    });
    
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "advision_export.csv";
    link.click();
  };

  const exportToJSON = () => {
    const currentLang = i18n.language || 'es';
    const cleanData = filteredHistory.map(item => ({
      archivo: item.nombreImagen,
      etiquetas: item.etiquetas ? item.etiquetas.map(e => ({
        nombre: e.nombres ? e.nombres[currentLang] : e.nombre,
        confianza: Number(e.confianza.toFixed(2))
      })) : [],
      textoDetectado: item.textoDetectado || []
    }));

    const jsonContent = JSON.stringify(cleanData, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "advision_export.json";
    link.click();
  };

  const exportToExcel = () => {
    const currentLang = i18n.language || 'es';
    const exportData = filteredHistory.map(item => ({
      "Nombre del archivo": item.nombreImagen,
      "Etiquetas": item.etiquetas ? item.etiquetas.map(e => {
        const name = e.nombres ? e.nombres[currentLang] : e.nombre;
        return `${name} (${e.confianza.toFixed(1)}%)`;
      }).join(", ") : "",
      "Texto Detectado": item.textoDetectado ? item.textoDetectado.join(" | ") : ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Análisis");
    XLSX.writeFile(workbook, "advision_export.xlsx");
  };

  return (
    <div className="min-h-screen bg-[#EEF2F6] dark:bg-[#0B1120] transition-colors duration-300 font-sans pb-20 relative">
      
      <div className="w-full bg-[#0F172A] dark:bg-[#020617] pt-6 pb-16 relative shadow-lg transition-colors duration-300">
        
        <div className="absolute top-6 right-8 z-50">
          <div className="relative">
            <img 
              onClick={() => setDropdownOpen(!dropdownOpen)} 
              src={currentUser?.photoURL || "https://ui-avatars.com/api/?name=" + (currentUser?.email || "User") + "&background=64748B&color=fff"} 
              alt="Perfil" 
              className="w-14 h-14 md:w-16 md:h-16 rounded-full cursor-pointer border-[3px] border-transparent hover:border-[#3B82F6] transition-all object-cover shadow-md"
            />
            
            {dropdownOpen && (
              <div className="absolute right-0 mt-3 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700 py-2 overflow-hidden transition-colors duration-300">
                <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 mb-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{currentUser?.displayName || t('dashboard.user')}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{currentUser?.email}</p>
                </div>
                
                <button 
                  onClick={() => { setDropdownOpen(false); navigate('/analytics'); }} 
                  className="w-full text-left px-4 py-2 text-sm text-[#3B82F6] hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-bold"
                >
                  {t('dashboard.go_to_analytics')}
                </button>

                {/* Nuevo acceso a la Comparación A/B */}
                <button 
                  onClick={() => { setDropdownOpen(false); navigate('/compare'); }} 
                  className="w-full text-left px-4 py-2 text-sm text-[#3B82F6] hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-bold"
                >
                  {t('dashboard.go_to_compare', 'Comparación A/B')}
                </button>
                
                <button 
                  onClick={() => { setDropdownOpen(false); navigate('/profile'); }} 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {t('dashboard.edit_profile')}
                </button>
                
                <button 
                  onClick={handleLogout} 
                  className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors font-medium"
                >
                  {t('dashboard.logout')}
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
            {t('dashboard.title')}
          </p>
          <div className="w-[400px] h-px bg-slate-700 dark:bg-slate-800 mt-8"></div>
        </div>

        <div className="max-w-[800px] mx-auto px-6 flex flex-col items-center mt-6">
          <div 
            className={`w-full border-2 border-dashed rounded-[24px] py-16 flex flex-col justify-center items-center cursor-pointer transition-all backdrop-blur-sm shadow-2xl ${
              isDragging 
                ? 'border-[#3B82F6] bg-[#3B82F6]/10' 
                : 'border-slate-600 dark:border-slate-700 bg-slate-800/50 dark:bg-slate-900/50 hover:border-[#3B82F6] hover:bg-slate-800/80 dark:hover:bg-slate-800/80'
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
                  <span className="text-[#3B82F6]">{files.length}</span> {files.length === 1 ? t('dashboard.file_selected_singular') : t('dashboard.files_selected_plural')}
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {files.slice(0, 3).map((f, i) => (
                    <span key={i} className="text-white text-[14px] bg-slate-700 dark:bg-slate-800 px-3 py-1.5 rounded-md truncate max-w-[150px]">
                      {f.name}
                    </span>
                  ))}
                  {files.length > 3 && (
                    <span className="text-slate-400 text-[14px] px-2 py-1.5 font-medium">
                      + {files.length - 3} {t('dashboard.more')}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-slate-300 text-[20px] md:text-[22px] font-medium text-center px-4">
                {t('dashboard.drag_drop')} <span className="text-[#3B82F6] font-bold hover:underline hover:text-blue-400 transition-colors">{t('dashboard.browse')}</span>
              </p>
            )}
          </div>

          <button 
            onClick={uploadToS3} 
            disabled={uploading || files.length === 0}
            className="mt-8 bg-[#0052FF] text-white text-[20px] font-bold px-14 py-4 rounded-[10px] hover:bg-[#003BCC] hover:scale-105 hover:shadow-[0_10px_25px_rgba(0,82,255,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none flex items-center justify-center min-w-[240px]"
          >
            {uploading ? t('dashboard.processing') : t('dashboard.process_ai')}
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 mt-16">
        
        <div className="flex flex-col gap-5 mb-10">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-[#0F172A] dark:text-white text-[34px] md:text-[38px] font-extrabold tracking-tight transition-colors duration-300">
                {t('dashboard.history_title')}
              </h2>
              <span className="bg-[#6D28D9] text-white text-[16px] font-bold px-4 py-1.5 rounded-full shadow-sm">
                {(searchTerm === '' && dateFilter === 'all' && confidenceFilter === 0) ? totalRecords : filteredHistory.length} {t('dashboard.records')}
              </span>
            </div>

            <div className="relative w-full md:max-w-[500px] xl:max-w-[600px] ml-auto">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                list="tags-options"
                placeholder={t('dashboard.search_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-[#1E293B] text-[#475569] dark:text-white text-[15px] font-medium border border-transparent dark:border-slate-700 pl-12 pr-4 py-3.5 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] shadow-sm placeholder:text-gray-400 [&::-webkit-calendar-picker-indicator]:!hidden [&::-webkit-list-button]:!hidden transition-colors duration-300"
              />
              <datalist id="tags-options">
                {uniqueTags.map((tag, idx) => (
                  <option key={idx} value={tag} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)} 
                className="bg-[#0F172A] dark:bg-slate-800 text-white border border-slate-700 dark:border-slate-600 px-5 py-2.5 rounded-[10px] font-bold text-[14px] hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-sm flex items-center gap-2"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                {t('dashboard.export')}
                <svg className={`w-4 h-4 transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              
              {exportDropdownOpen && (
                <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-[#1E293B] rounded-[12px] shadow-xl border border-slate-100 dark:border-slate-700 py-2 z-50 overflow-hidden transition-colors duration-300">
                  <button 
                    onClick={() => { exportToCSV(); setExportDropdownOpen(false); }} 
                    className="w-full text-left px-4 py-2.5 text-sm text-[#0F172A] dark:text-white font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    {t('dashboard.export_csv')}
                  </button>
                  <button 
                    onClick={() => { exportToJSON(); setExportDropdownOpen(false); }} 
                    className="w-full text-left px-4 py-2.5 text-sm text-[#0F172A] dark:text-white font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    {t('dashboard.export_json')}
                  </button>
                  <button 
                    onClick={() => { exportToExcel(); setExportDropdownOpen(false); }} 
                    className="w-full text-left px-4 py-2.5 text-sm text-[#0F172A] dark:text-white font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-green-600"></span>
                    {t('dashboard.export_excel')}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-[10px] font-bold text-[14px] border transition-colors shadow-sm whitespace-nowrap ${showFilters ? 'bg-[#3B82F6] text-white border-[#3B82F6]' : 'bg-white dark:bg-[#1E293B] text-[#475569] dark:text-white border-transparent dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500'}`}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
              {t('dashboard.filters')}
            </button>
          </div>

          {showFilters && (
            <div className="bg-white dark:bg-[#1E293B] p-5 rounded-[12px] shadow-sm border border-slate-100 dark:border-slate-700 flex flex-wrap gap-4 animate-in fade-in slide-in-from-top-2 transition-colors duration-300">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 text-[#475569] dark:text-slate-200 text-[14px] font-semibold border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] appearance-none cursor-pointer min-w-[160px]"
              >
                <option value="all">{t('dashboard.filter_date_all')}</option>
                <option value="today">{t('dashboard.filter_date_today')}</option>
                <option value="week">{t('dashboard.filter_date_week')}</option>
                <option value="month">{t('dashboard.filter_date_month')}</option>
              </select>

              <select
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-800 text-[#475569] dark:text-slate-200 text-[14px] font-semibold border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] appearance-none cursor-pointer min-w-[180px]"
              >
                <option value={0}>{t('dashboard.filter_conf_all')}</option>
                <option value={95}>{t('dashboard.filter_conf_95')}</option>
                <option value={90}>{t('dashboard.filter_conf_90')}</option>
              </select>
            </div>
          )}

          {(dateFilter !== 'all' || confidenceFilter !== 0) && (
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="text-[13px] font-bold text-[#64748B] dark:text-slate-400 mr-1">{t('dashboard.active_filters')}</span>
              {dateFilter !== 'all' && (
                <span onClick={() => setDateFilter('all')} className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-full text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                  {t(`dashboard.filter_date_${dateFilter}`)}
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </span>
              )}
              {confidenceFilter !== 0 && (
                <span onClick={() => setConfidenceFilter(0)} className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-full text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                  {t(`dashboard.filter_conf_${confidenceFilter}`)}
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </span>
              )}
              <button onClick={() => { setDateFilter('all'); setConfidenceFilter(0); }} className="text-[12px] font-bold text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white ml-2 underline transition-colors">
                {t('dashboard.clear_filters')}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {filteredHistory.map((item, index) => (
            <article 
              key={item.id} 
              id={`report-card-${item.id}`}
              ref={filteredHistory.length === index + 1 ? lastImageElementRef : null}
              className="bg-white dark:bg-[#1E293B] rounded-[16px] shadow-sm overflow-hidden flex flex-col border border-gray-100 dark:border-slate-700 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl relative"
            >
              
              <div className="w-full h-[280px] bg-gray-100 dark:bg-slate-800 overflow-hidden relative">
                <img
                  src={`https://${BUCKET_NAME}.s3.eu-south-2.amazonaws.com/thumbnails/${item.nombreImagen}`}
                  alt={item.nombreImagen}
                  className={`w-full h-full object-cover transition-all duration-500 ${item.moderacion?.length > 0 && !revealedImages[item.id] ? 'blur-2xl scale-110' : ''}`}
                  loading="lazy"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    e.target.onerror = null; 
                    e.target.src = `https://${BUCKET_NAME}.s3.eu-south-2.amazonaws.com/originals/${item.nombreImagen}`;
                  }}
                />
                
                {item.moderacion?.length > 0 && !revealedImages[item.id] && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-6 text-center z-10">
                    <svg className="w-10 h-10 text-white/90 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
                    <h4 className="text-white font-bold text-[18px] mb-1">{t('dashboard.sensitive_content')}</h4>
                    <p className="text-gray-300 text-[13px] mb-5">{t('dashboard.sensitive_desc')}</p>
                    
                    <div className="flex flex-col gap-3 w-full max-w-[200px]">
                      <button 
                        onClick={() => setRevealedImages(prev => ({ ...prev, [item.id]: true }))} 
                        className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-4 py-2.5 rounded-lg text-[13px] font-bold transition-colors"
                      >
                        {t('dashboard.see_photo')}
                      </button>
                      <button 
                        onClick={() => setRevealedReasons(prev => ({ ...prev, [item.id]: !prev[item.id] }))} 
                        className="text-white/70 hover:text-white underline text-[13px] font-semibold transition-colors"
                      >
                        {revealedReasons[item.id] ? t('dashboard.hide_reasons') : t('dashboard.see_reasons')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-6 flex-1 flex flex-col">
                <div className="mb-5">
                  <p className="text-[12px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider mb-1">{t('dashboard.filename')}</p>
                  <h3 className="text-[#0F172A] dark:text-white text-[16px] font-bold truncate" title={cleanFileName(item.nombreImagen)}>
                    {cleanFileName(item.nombreImagen)}
                  </h3>
                </div>

                {/* --- BLOQUE DE MODERACIÓN ACTUALIZADO CON TRADUCCIÓN --- */}
                {item.moderacion?.length > 0 && revealedReasons[item.id] && (
                  <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 rounded-lg animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                      <p className="text-[13px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">{t('dashboard.content_warning')}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.moderacion.map((mod, idx) => {
                        const currentLang = i18n.language || 'es';
                        const displayName = mod.nombres ? mod.nombres[currentLang] : mod.nombre;
                        return (
                          <span key={idx} className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-[11px] px-2 py-1 rounded-md font-bold">
                            <span className="capitalize">{displayName}</span> ({(mod.confianza).toFixed(1)}%)
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* ---------------------------------------- */}
                
                <div className="flex flex-col flex-1">
                  <p className="text-[12px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider mb-3">{t('dashboard.tags')}</p>
                  <div className="flex flex-col gap-3">
                    {item.etiquetas?.slice(0, 5).map((label, i) => {
                      const currentLang = i18n.language || 'es';
                      const displayName = label.nombres ? label.nombres[currentLang] : label.nombre;

                      return (
                        <div key={i} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-[13px] font-bold text-[#0F172A] dark:text-slate-200">
                            <span className="capitalize">{displayName}</span>
                            <span className="text-gray-500 dark:text-slate-400">{label.confianza.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${label.confianza}%`,
                                backgroundColor: label.confianza > 95 ? '#10b981' : label.confianza > 85 ? '#3B82F6' : '#f59e0b'
                              }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {item.textoDetectado && item.textoDetectado.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[12px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">{t('dashboard.detected_text')}</p>
                      
                      {/* Badge de Sentimiento */}
                      {item.sentimiento && (
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold shadow-sm ${
                          item.sentimiento === 'POSITIVE' ? 'bg-green-100 text-green-700 border border-green-200' :
                          item.sentimiento === 'NEGATIVE' ? 'bg-red-100 text-red-700 border border-red-200' :
                          item.sentimiento === 'MIXED' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                          'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}>
                          {t(`dashboard.sentiment_${item.sentimiento}`)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                       {item.textoDetectado.slice(0, 3).map((txt, idx) => (
                          <span key={idx} className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800 text-[12px] px-2.5 py-1 rounded-md font-medium">"{txt}"</span>
                       ))}
                    </div>
                  </div>
                )}

                {/* --- NUEVO BLOQUE: PALETA DE COLORES DOMINANTES --- */}
                {item.coloresDominantes && item.coloresDominantes.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center">
                    <p className="text-[12px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">{t('dashboard.dominant_colors')}</p>
                    <div className="flex gap-2">
                      {item.coloresDominantes.map((hex, idx) => (
                        <div
                          key={idx}
                          className="w-6 h-6 rounded-full border border-gray-200 dark:border-slate-600 shadow-sm transition-transform hover:scale-110 cursor-help"
                          style={{ backgroundColor: hex }}
                          title={`Color HEX: ${hex}`}
                        ></div>
                      ))}
                    </div>
                  </div>
                )}
                {/* --------------------------------------------------- */}

                <button 
                  onClick={() => exportToPDF(item, `report-card-${item.id}`)}
                  className="mt-6 w-full bg-slate-50 dark:bg-slate-800 text-[#0F172A] dark:text-white border border-slate-200 dark:border-slate-600 text-[13px] font-bold py-2.5 rounded-[8px] hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  {t('dashboard.export_pdf')}
                </button>
              </div>
            </article>
          ))}
        </div>

        {loadingMore && (
          <div className="flex justify-center mt-8 w-full pb-8">
            <svg className="animate-spin h-8 w-8 text-[#3B82F6]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

      </div>
    </div>
  );
}

export default Dashboard;