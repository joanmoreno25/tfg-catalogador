import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from '../firebase-config';
import { useAuth } from '../context/AuthContext';

function Analytics() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllHistory = async () => {
      if (!currentUser) return;
      try {
        const q = query(
          collection(db, "analisis"), 
          where("userId", "==", currentUser.uid),
          orderBy("fechaCreacion", "desc")
        );
        const querySnapshot = await getDocs(q);
        const docs = querySnapshot.docs.map(doc => doc.data());
        setHistory(docs);
      } catch (error) {
        console.error("Error al cargar datos para analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllHistory();
  }, [currentUser]);

  let totalConfidence = 0;
  let labelCount = 0;
  let totalTexts = 0;
  const tagFrequencies = {};
  const dateMap = {};
  
  let highConf = 0;
  let medConf = 0;
  let lowConf = 0;

  history.forEach(item => {
    if (item.textoDetectado) {
      totalTexts += item.textoDetectado.length;
    }

    if (item.fechaCreacion) {
      const dateStr = item.fechaCreacion.toDate().toLocaleDateString(i18n.language || 'es', { month: 'short', day: 'numeric' });
      dateMap[dateStr] = (dateMap[dateStr] || 0) + 1;
    }

    if (item.etiquetas) {
      item.etiquetas.forEach(tag => {
        totalConfidence += tag.confianza;
        labelCount++;
        
        const currentLang = i18n.language || 'es';
        const tagName = tag.nombres ? tag.nombres[currentLang] : tag.nombre;
        
        tagFrequencies[tagName] = (tagFrequencies[tagName] || 0) + 1;

        if (tag.confianza >= 90) highConf++;
        else if (tag.confianza >= 80) medConf++;
        else lowConf++;
      });
    }
  });

  const avgConfidence = labelCount > 0 ? (totalConfidence / labelCount).toFixed(1) : 0;

  const barChartData = Object.entries(tagFrequencies)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const lineChartData = Object.entries(dateMap)
    .map(([date, count]) => ({ date, count }))
    .reverse(); 

  const pieChartData = [
    { name: t('dashboard.high_conf'), value: highConf, color: '#10B981' },
    { name: t('dashboard.med_conf'), value: medConf, color: '#F59E0B' },
    { name: t('dashboard.low_conf'), value: lowConf, color: '#EF4444' }
  ].filter(item => item.value > 0);

  return (
    <div className="min-h-screen bg-[#EEF2F6] font-sans pb-20">
      
      <div className="w-full bg-[#0F172A] py-6 shadow-lg">
        <div className="max-w-[1400px] mx-auto px-6 flex justify-between items-center">
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-white hover:text-[#3B82F6] flex items-center gap-2 font-semibold transition-colors"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            {t('dashboard.back_to_dashboard')}
          </button>
          <h1 className="text-white text-[24px] font-bold tracking-tight">
            {t('dashboard.analytics_title')}
          </h1>
          <div className="w-[100px]"></div> 
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 mt-10">
        
        {loading ? (
          <div className="flex justify-center mt-20">
            <svg className="animate-spin h-10 w-10 text-[#3B82F6]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-white p-6 rounded-[16px] shadow-sm border border-gray-100 flex items-center gap-4 hover:-translate-y-1 transition-transform">
                <div className="bg-blue-50 p-4 rounded-full text-blue-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </div>
                <div>
                  <p className="text-gray-500 text-[13px] font-bold uppercase">{t('dashboard.total_assets')}</p>
                  <h3 className="text-[#0F172A] text-[32px] font-extrabold">{history.length}</h3>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[16px] shadow-sm border border-gray-100 flex items-center gap-4 hover:-translate-y-1 transition-transform">
                <div className="bg-emerald-50 p-4 rounded-full text-emerald-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div>
                  <p className="text-gray-500 text-[13px] font-bold uppercase">{t('dashboard.avg_confidence')}</p>
                  <h3 className="text-[#0F172A] text-[32px] font-extrabold">{avgConfidence}%</h3>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[16px] shadow-sm border border-gray-100 flex items-center gap-4 hover:-translate-y-1 transition-transform">
                <div className="bg-purple-50 p-4 rounded-full text-purple-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                </div>
                <div>
                  <p className="text-gray-500 text-[13px] font-bold uppercase">{t('dashboard.total_texts')}</p>
                  <h3 className="text-[#0F172A] text-[32px] font-extrabold">{totalTexts}</h3>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
              
              <div className="bg-white p-8 rounded-[16px] shadow-sm border border-gray-100">
                <h3 className="text-[#0F172A] text-[18px] font-bold mb-6">{t('dashboard.top_tags_chart')}</h3>
                {barChartData.length > 0 ? (
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} margin={{ top: 20, right: 30, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#64748B', fontSize: 13, fontWeight: 600 }}
                          angle={-45}
                          textAnchor="end"
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13, fontWeight: 600 }} />
                        <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-gray-400 font-medium">No hay datos suficientes.</div>
                )}
              </div>

              <div className="bg-white p-8 rounded-[16px] shadow-sm border border-gray-100">
                <h3 className="text-[#0F172A] text-[18px] font-bold mb-6">{t('dashboard.images_over_time')}</h3>
                {lineChartData.length > 0 ? (
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineChartData} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13, fontWeight: 600 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13, fontWeight: 600 }} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey="count" stroke="#8B5CF6" strokeWidth={4} dot={{ r: 4, fill: '#8B5CF6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-gray-400 font-medium">No hay datos suficientes.</div>
                )}
              </div>

            </div>

            <div className="bg-white p-8 rounded-[16px] shadow-sm border border-gray-100 mb-10 lg:w-1/2 mx-auto">
              <h3 className="text-[#0F172A] text-[18px] font-bold mb-6 text-center">{t('dashboard.confidence_distribution')}</h3>
              {pieChartData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontWeight: 600, color: '#475569' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400 font-medium">No hay datos suficientes.</div>
              )}
            </div>

          </>
        )}
      </div>
    </div>
  );
}

export default Analytics;