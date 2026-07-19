import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from '../firebase-config';
import { useAuth } from '../context/AuthContext';
import { BUCKET_NAME } from '../aws-config';
import { Helmet } from 'react-helmet-async';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from 'recharts';

/**
 * Compare component.
 * Provides an A/B testing interface allowing users to select two analyzed images
 * from their catalog and visually compare their AI-generated metrics, tags, and confidence scores.
 * 
 * @returns {JSX.Element} The rendered comparison dashboard.
 */
const Compare = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [imageA, setImageA] = useState(null);
  const [imageB, setImageB] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  useEffect(() => {
    /**
     * Fetches the user's analyzed assets catalog from Firestore.
     */
    const fetchCatalog = async () => {
      if (!currentUser) return;
      setLoading(true);
      try {
        const q = query(collection(db, "analisis"), where("userId", "==", currentUser.uid), orderBy("fechaCreacion", "desc"));
        const querySnapshot = await getDocs(q);
        setCatalog(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error al cargar el catálogo:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, [currentUser]);

  /**
   * Assigns the selected catalog item to the currently active variant slot (A or B).
   * 
   * @param {Object} image - The selected image object.
   */
  const handleSelectImage = (image) => {
    if (activeModal === 'A') setImageA(image);
    if (activeModal === 'B') setImageB(image);
    setActiveModal(null);
  };

  /**
   * Calculates the average confidence score across a set of AI-generated tags.
   * 
   * @param {Array} etiquetas - The array of tag objects.
   * @returns {string|number} The computed average confidence formatted to 1 decimal.
   */
  const getAvgConfidence = (etiquetas) => {
    if (!etiquetas || etiquetas.length === 0) return 0;
    return (etiquetas.reduce((acc, tag) => acc + (tag.confianza || 0), 0) / etiquetas.length).toFixed(1);
  };

  /**
   * Memoized computation of the comparative chart dataset based on selected images.
   */
  const chartData = useMemo(() => {
    if (!imageA || !imageB) return [];
    const tagMap = {};
    const currentLang = i18n.language || 'es';

    const processTags = (image, key) => {
      image.etiquetas?.forEach(t => {
        const name = t.nombres ? t.nombres[currentLang] : t.nombre;
        if (!tagMap[name]) tagMap[name] = { name, A: 0, B: 0 };
        tagMap[name][key] = Number(t.confianza.toFixed(1));
      });
    };

    processTags(imageA, 'A');
    processTags(imageB, 'B');

    return Object.values(tagMap)
      .sort((a, b) => (b.A + b.B) - (a.A + a.B))
      .slice(0, 10);
  }, [imageA, imageB, i18n.language]);

  const renderDetailedInfo = (item) => {
    const currentLang = i18n.language || 'es';
    return (
      <div className="flex flex-col gap-4 mt-4 text-left w-full">
        <div className="flex flex-col gap-3">
          <p className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider">{t('dashboard.tags', 'Etiquetas')}</p>
          {item.etiquetas?.slice(0, 5).map((label, i) => {
            const displayName = label.nombres ? label.nombres[currentLang] : label.nombre;
            return (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[13px] font-bold text-[#0F172A]">
                  <span className="capitalize truncate max-w-[150px]">{displayName}</span>
                  <span className="text-gray-500">{label.confianza.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${label.confianza}%`, backgroundColor: label.confianza > 95 ? '#10b981' : label.confianza > 85 ? '#3B82F6' : '#f59e0b', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>
                </div>
              </div>
            );
          })}
        </div>

        {item.textoDetectado?.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider">{t('dashboard.detected_text', 'Texto')}</p>
              {item.sentimiento && (
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold shadow-sm print-exact-color ${
                  item.sentimiento === 'POSITIVE' ? 'bg-green-100 text-green-700' :
                  item.sentimiento === 'NEGATIVE' ? 'bg-red-100 text-red-700' :
                  item.sentimiento === 'MIXED' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                }`} style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{item.sentimiento}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
               {item.textoDetectado.slice(0, 4).map((txt, idx) => (
                  <span key={idx} className="bg-blue-50 text-blue-700 border border-blue-100 text-[11px] px-2 py-1 rounded-md font-medium print-exact-color" style={{ backgroundColor: '#eff6ff', borderColor: '#dbeafe', color: '#1d4ed8', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>"{txt}"</span>
               ))}
            </div>
          </div>
        )}

        {item.coloresDominantes?.length > 0 && (
          <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
            <p className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider">{t('dashboard.dominant_colors', 'Paleta Dominante')}</p>
            <div className="flex gap-2">
              {item.coloresDominantes.map((hex, idx) => (
                <div 
                  key={idx} 
                  className="w-5 h-5 rounded-full border border-gray-200 shadow-sm print-exact-color" 
                  style={{ backgroundColor: hex, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} 
                  title={hex}
                ></div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderImagePanel = (image, variant, setActive) => (
    <div className="flex-1 bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex flex-col relative overflow-hidden print:shadow-none print:border-gray-300 print:p-4">
      <h2 className="text-[#0F172A] text-[18px] font-bold text-center mb-4 uppercase tracking-wide print:text-[16px]">{variant}</h2>
      
      <div 
        className={`flex-1 flex flex-col items-center ${!image ? 'border-2 border-dashed border-gray-300 hover:border-[#3B82F6] bg-gray-50 cursor-pointer p-6 rounded-[12px] transition-all min-h-[350px] justify-center group' : ''}`}
        onClick={() => !image && setActiveModal(setActive)}
      >
        {image ? (
          <div className="w-full flex flex-col">
            <div className="relative group w-full h-[220px] rounded-[12px] overflow-hidden mb-4 border border-gray-200 shadow-sm print:h-[200px] print:rounded-lg">
              <img 
                src={`https://${BUCKET_NAME}.s3.eu-south-2.amazonaws.com/thumbnails/${image.nombreImagen}`} 
                alt="Seleccionada" 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                crossOrigin="anonymous"
                onError={(e) => { e.target.onerror = null; e.target.src = `https://${BUCKET_NAME}.s3.eu-south-2.amazonaws.com/originals/${image.nombreImagen}`; }}
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center print:hidden">
                <button onClick={() => setActiveModal(setActive)} className="text-white font-bold bg-[#3B82F6] hover:bg-blue-600 px-6 py-2 rounded-full shadow-lg transition-colors">
                  {t('dashboard.change_image', 'Cambiar Imagen')}
                </button>
              </div>
            </div>
            
            <div className="w-full flex justify-between items-end border-b border-gray-100 pb-3">
               <div>
                 <p className="text-sm text-[#0F172A] font-extrabold truncate max-w-[200px]" title={image.nombreImagen}>{image.nombreImagen}</p>
                 <p className="text-xs text-gray-400 font-semibold">{new Date(image.fechaCreacion?.toDate()).toLocaleDateString()}</p>
               </div>
               <div className="text-right">
                 <p className="text-[10px] uppercase font-bold text-gray-400">{t('dashboard.avg_confidence', 'Confianza Media')}</p>
                 <p className="text-[#3B82F6] font-extrabold text-lg leading-none print-exact-color" style={{ color: '#3B82F6', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{getAvgConfidence(image.etiquetas)}%</p>
               </div>
            </div>
            {renderDetailedInfo(image)}
          </div>
        ) : (
          <div className="text-center flex flex-col items-center gap-4 print:hidden">
            <div className={`p-5 rounded-full transition-all duration-300 ${setActive === 'A' ? 'bg-blue-50 text-blue-500' : 'bg-purple-50 text-purple-500'} group-hover:scale-110`}>
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <p className={`text-base font-semibold ${setActive === 'A' ? 'text-blue-600' : 'text-purple-600'}`}>
              {t(`dashboard.select_image_${setActive.toLowerCase()}`, `Haz clic para seleccionar la Imagen ${setActive}`)}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Helmet>
        <title>{t('dashboard.compare_title', 'Comparación A/B')} | AdVision</title>
        <meta name="description" content={t('dashboard.compare_desc', 'Compara variantes de anuncios y analiza métricas de IA.')} />
      </Helmet>

      <style>{`
        @media print {
          @page { margin: 0; size: auto; }
          body { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            padding: 1cm 1.5cm !important;
            background-color: white !important;
          }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-[#EEF2F6] font-sans pb-20 print:bg-white print:pb-0 print:min-h-0">
        
        {/* Dark header (Hidden when printing) */}
        <div className="w-full bg-[#0F172A] py-6 shadow-lg print:hidden">
          <div className="max-w-[1400px] mx-auto px-6 flex justify-between items-center relative">
            <button onClick={() => navigate('/dashboard')} className="text-white hover:text-[#3B82F6] flex items-center gap-2 font-semibold transition-colors z-10">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              {t('dashboard.back_to_dashboard', 'Volver al Dashboard')}
            </button>
            <h1 className="text-white text-[24px] font-bold tracking-tight absolute left-1/2 transform -translate-x-1/2 w-full text-center pointer-events-none">
              {t('dashboard.compare_title', 'Panel de Comparación A/B')}
            </h1>
            <div className="w-[100px]"></div> 
          </div>
        </div>

        {/* Professional Header Exclusive for PDF Export */}
        <div className="hidden print:block max-w-[1400px] mx-auto border-b-2 border-gray-200 pb-6 mb-8 pt-4">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-black text-[#0F172A] tracking-tight">AdVision</h1>
              <h2 className="text-2xl font-bold text-gray-500 mt-2">Reporte de Análisis Comparativo A/B</h2>
            </div>
            <div className="text-right border-l-2 border-gray-100 pl-6">
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Fecha de Generación</p>
              <p className="text-lg font-bold text-[#0F172A]">{new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
          {imageA && imageB && (
            <div className="mt-6 pt-5 border-t border-gray-100 flex gap-10 text-sm">
              <p><span className="font-bold text-[#3B82F6] uppercase tracking-wider mr-2">{t('dashboard.image_a', 'Variante A')}:</span> <span className="font-semibold text-gray-600">{imageA.nombreImagen}</span></p>
              <p><span className="font-bold text-[#8B5CF6] uppercase tracking-wider mr-2">{t('dashboard.image_b', 'Variante B')}:</span> <span className="font-semibold text-gray-600">{imageB.nombreImagen}</span></p>
            </div>
          )}
        </div>

        <div className="max-w-[1400px] mx-auto px-6 mt-10 flex flex-col gap-10 print:mt-0 print:px-0">
          
          <div className="flex flex-col lg:flex-row gap-8 items-stretch print:flex-row print:gap-6">
            {renderImagePanel(imageA, t('dashboard.image_a', 'Variante A'), 'A')}
            
            <div className="hidden lg:flex flex-col items-center justify-center pt-10 print:hidden">
               <div className="bg-white p-3 rounded-full shadow-md border border-gray-100 z-10 text-gray-400 font-black text-xl italic">VS</div>
            </div>

            {renderImagePanel(imageB, t('dashboard.image_b', 'Variante B'), 'B')}
          </div>

          <div className={`bg-white rounded-[16px] shadow-sm p-8 border border-gray-100 transition-all duration-500 print:shadow-none print:border-none print:p-0 print:mt-6 ${(!imageA || !imageB) ? 'opacity-50 grayscale print:hidden' : ''}`}>
            {(!imageA || !imageB) ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-center print:hidden">
                <div className="bg-gray-100 p-4 rounded-full mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002-2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-500">{t('dashboard.compare_pending', 'Análisis Gráfico Bloqueado')}</h3>
                <p className="text-gray-400 mt-2">{t('dashboard.compare_pending_desc', 'Selecciona ambas variantes para generar la comparativa de datos de mercado.')}</p>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center mb-10 print:mb-6">
                   <h3 className="text-2xl font-extrabold text-[#0F172A]">{t('dashboard.comparative_results', 'Resultados del Análisis Comparativo')}</h3>
                   <p className="text-gray-500 font-medium mt-1">{t('dashboard.comparative_subtitle', 'Comparativa de confianza algorítmica y métricas de mercado')}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:grid-cols-1 print:gap-8">
                  
                  {/* Chart 1: Bar Chart */}
                  <div className="lg:col-span-2 h-[400px] w-full border border-gray-100 rounded-xl p-4 bg-gray-50 print:bg-white print:border-gray-200">
                    <h4 className="text-center font-bold text-[#0F172A] mb-4 text-xs uppercase tracking-wider">{t('dashboard.top_tags_vs_confidence', 'Top Etiquetas vs Confianza')}</h4>
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} angle={-35} textAnchor="end" height={60} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} domain={[0, 100]} />
                        <RechartsTooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                        <Bar dataKey="A" name={t('dashboard.image_a', 'Variante A')} fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="B" name={t('dashboard.image_b', 'Variante B')} fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Columnar Summary Table (Strict Layout) */}
                  <div className="lg:col-span-1 flex flex-col justify-between">
                     <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm print:shadow-none print:border-gray-300">
                        <h4 className="font-extrabold text-[#0F172A] mb-6 border-b pb-3 uppercase text-sm tracking-wider">{t('dashboard.global_metrics', 'Métricas Globales')}</h4>
                        
                        <div className="w-full flex flex-col">
                          
                          {/* Column Headers */}
                          <div className="grid grid-cols-4 gap-3 mb-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider items-end">
                            <div className="col-span-2">{t('dashboard.metric', 'Métrica')}</div>
                            <div className="text-center text-[#3B82F6]">{t('dashboard.var_a', 'Var. A')}</div>
                            <div className="text-center text-[#8B5CF6]">{t('dashboard.var_b', 'Var. B')}</div>
                          </div>

                          {/* Row 1 */}
                          <div className="grid grid-cols-4 gap-3 items-center py-3 border-t border-gray-50">
                             <div className="col-span-2 text-xs font-semibold text-gray-600">{t('dashboard.global_confidence', 'Confianza Global')}</div>
                             <div className="text-center">
                                <span className="inline-block w-full bg-blue-50 text-blue-700 border border-blue-100 px-1 py-1.5 rounded-lg text-xs font-bold print-exact-color" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#dbeafe', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                  {getAvgConfidence(imageA.etiquetas)}%
                                </span>
                             </div>
                             <div className="text-center">
                                <span className="inline-block w-full bg-purple-50 text-purple-700 border border-purple-100 px-1 py-1.5 rounded-lg text-xs font-bold print-exact-color" style={{ backgroundColor: '#faf5ff', color: '#6d28d9', borderColor: '#f3e8ff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                  {getAvgConfidence(imageB.etiquetas)}%
                                </span>
                             </div>
                          </div>

                          {/* Row 2 */}
                          <div className="grid grid-cols-4 gap-3 items-center py-3 border-t border-gray-50">
                             <div className="col-span-2 text-xs font-semibold text-gray-600">{t('dashboard.extracted_tags', 'Etiquetas Extraídas')}</div>
                             <div className="text-center">
                                <span className="inline-block w-full bg-blue-50 text-blue-700 border border-blue-100 px-1 py-1.5 rounded-lg text-xs font-bold print-exact-color" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#dbeafe', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                  {imageA.etiquetas?.length || 0}
                                </span>
                             </div>
                             <div className="text-center">
                                <span className="inline-block w-full bg-purple-50 text-purple-700 border border-purple-100 px-1 py-1.5 rounded-lg text-xs font-bold print-exact-color" style={{ backgroundColor: '#faf5ff', color: '#6d28d9', borderColor: '#f3e8ff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                  {imageB.etiquetas?.length || 0}
                                </span>
                             </div>
                          </div>

                          {/* Row 3 */}
                          <div className="grid grid-cols-4 gap-3 items-center py-3 border-t border-gray-50">
                             <div className="col-span-2 text-xs font-semibold text-gray-600">{t('dashboard.text_lines', 'Líneas de Texto')}</div>
                             <div className="text-center">
                                <span className="inline-block w-full bg-blue-50 text-blue-700 border border-blue-100 px-1 py-1.5 rounded-lg text-xs font-bold print-exact-color" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#dbeafe', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                  {imageA.textoDetectado?.length || 0}
                                </span>
                             </div>
                             <div className="text-center">
                                <span className="inline-block w-full bg-purple-50 text-purple-700 border border-purple-100 px-1 py-1.5 rounded-lg text-xs font-bold print-exact-color" style={{ backgroundColor: '#faf5ff', color: '#6d28d9', borderColor: '#f3e8ff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                  {imageB.textoDetectado?.length || 0}
                                </span>
                             </div>
                          </div>

                          {/* Row 4 */}
                          <div className="grid grid-cols-4 gap-3 items-center py-3 border-t border-gray-50">
                             <div className="col-span-2 text-xs font-semibold text-gray-600">{t('dashboard.moderation', 'Moderación')}</div>
                             <div className="text-center">
                                <span className={`inline-block w-full border px-1 py-1.5 rounded-lg text-[11px] font-bold print-exact-color ${imageA.moderacion?.length > 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`} style={imageA.moderacion?.length > 0 ? {backgroundColor: '#fef2f2', color: '#b91c1c', borderColor: '#fee2e2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'} : {backgroundColor: '#ecfdf5', color: '#047857', borderColor: '#d1fae5', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                  {imageA.moderacion?.length > 0 ? t('dashboard.alerts', 'Alertas') : t('dashboard.clean', 'Limpio')}
                                </span>
                             </div>
                             <div className="text-center">
                                <span className={`inline-block w-full border px-1 py-1.5 rounded-lg text-[11px] font-bold print-exact-color ${imageB.moderacion?.length > 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`} style={imageB.moderacion?.length > 0 ? {backgroundColor: '#fef2f2', color: '#b91c1c', borderColor: '#fee2e2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'} : {backgroundColor: '#ecfdf5', color: '#047857', borderColor: '#d1fae5', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                  {imageB.moderacion?.length > 0 ? t('dashboard.alerts', 'Alertas') : t('dashboard.clean', 'Limpio')}
                                </span>
                             </div>
                          </div>
                        </div>
                     </div>
                     
                     <button onClick={() => window.print()} className="mt-6 w-full bg-[#0F172A] hover:bg-gray-800 text-white font-bold py-4 rounded-xl shadow-md transition-colors flex justify-center items-center gap-2 print:hidden">
                       <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                       {t('dashboard.export_pdf_report', 'Exportar Reporte PDF')}
                     </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Selector */}
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/80 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-white rounded-[20px] w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-xl font-bold text-[#0F172A]">{t('dashboard.select_catalog_variant', 'Seleccionar del Catálogo - Variante')} {activeModal}</h3>
                <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {loading ? (
                  <div className="col-span-full flex justify-center py-10">
                    <svg className="animate-spin h-10 w-10 text-[#3B82F6]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  </div>
                ) : catalog.map((item) => (
                  <div key={item.id} onClick={() => handleSelectImage(item)} className="group rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-[#3B82F6] shadow-sm hover:shadow-md transition-all relative flex flex-col bg-white">
                    <img src={`https://${BUCKET_NAME}.s3.eu-south-2.amazonaws.com/thumbnails/${item.nombreImagen}`} alt={item.nombreImagen} className="w-full h-40 object-cover" crossOrigin="anonymous" onError={(e) => { e.target.onerror = null; e.target.src = `https://${BUCKET_NAME}.s3.eu-south-2.amazonaws.com/originals/${item.nombreImagen}`; }} />
                    <div className="p-4 border-t border-gray-100 flex-1 flex flex-col justify-between">
                      <div className="mb-3">
                        <p className="text-sm font-bold text-[#0F172A] truncate" title={item.nombreImagen}>{item.nombreImagen}</p>
                        <p className="text-xs text-gray-400 mt-1 flex justify-between">
                          <span>{new Date(item.fechaCreacion?.toDate()).toLocaleDateString()}</span>
                          <span className="font-semibold text-[#10B981]">{getAvgConfidence(item.etiquetas)}% conf.</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Compare;