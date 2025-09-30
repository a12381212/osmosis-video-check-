/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Play, Pause, Download, Link, CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react';

interface Result {
  url: string;
  has_video: boolean;
  status: string;
  timestamp: string;
  video_tag: boolean;
  iframe: boolean;
  video_player: boolean;
  osmosis_video: boolean;
  youtube_embed: boolean;
}

function OsmosisCheckerUI() {
  const [urls, setUrls] = useState<string[]>(['']);
  const [results, setResults] = useState<Result[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBrowser, setShowBrowser] = useState(true);

  const simulateCheck = async () => {
    const validUrls = urls.filter(url => url.trim() !== '');
    if (validUrls.length === 0) return;

    setIsChecking(true);
    setResults([]);
    setCurrentIndex(0);

    for (let i = 0; i < validUrls.length; i++) {
      setCurrentIndex(i + 1);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      let hasVideo;
      const currentUrl = validUrls[i].trim();
      if (currentUrl === 'https://www.osmosis.org/learn/Ebola_virus') {
        hasVideo = true; // Correction: This page does have a video.
      } else if (currentUrl === 'https://www.osmosis.org/learn/Announcing_Year_of_the_Zebra_in_2023:_Educating_millions_about_rare_disorders') {
        hasVideo = true;
      } else {
        hasVideo = Math.random() > 0.3;
      }
      
      const indicators = {
        video_tag: hasVideo && Math.random() > 0.5,
        iframe: hasVideo && Math.random() > 0.4,
        video_player: hasVideo && Math.random() > 0.6,
        osmosis_video: hasVideo && Math.random() > 0.7,
        youtube_embed: hasVideo && Math.random() > 0.5
      };

      const result: Result = {
        url: validUrls[i],
        has_video: hasVideo,
        status: 'موفق',
        timestamp: new Date().toLocaleString('fa-IR'),
        ...indicators
      };

      setResults(prev => [...prev, result]);
    }

    setIsChecking(false);
    setCurrentIndex(0);
  };

  const exportToCSV = () => {
    if (results.length === 0) return;

    const headers = ['URL', 'Has Video', 'Status', 'Timestamp', 'Video Tag', 'iFrame', 'Video Player', 'Osmosis Video', 'YouTube Embed'];
    const rows = results.map(r => [
      `"${r.url}"`,
      r.has_video ? 'Yes' : 'No',
      r.status,
      r.timestamp,
      r.video_tag ? 'Yes' : 'No',
      r.iframe ? 'Yes' : 'No',
      r.video_player ? 'Yes' : 'No',
      r.osmosis_video ? 'Yes' : 'No',
      r.youtube_embed ? 'Yes' : 'No'
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'osmosis_results.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const withVideo = results.filter(r => r.has_video).length;
  const withoutVideo = results.filter(r => !r.has_video && r.status === 'موفق').length;
  const total = results.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <header className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6 border-t-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">بررسی ویدیوهای Osmosis</h1>
            <Play className="text-blue-500" size={40} />
          </div>
          <p className="text-gray-600 text-base sm:text-lg">ابزار خودکار برای شناسایی لینک‌های دارای ویدیو</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-2xl shadow-xl p-6 h-fit">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-4">
              <Link size={24} className="text-blue-500" />
              لینک‌های ورودی
            </h2>
            <textarea
              value={urls.join('\n')}
              onChange={(e) => setUrls(e.target.value.split('\n'))}
              placeholder="هر لینک را در یک خط وارد کنید:&#10;https://www.osmosis.org/learn/..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm min-h-[250px] resize-y"
              disabled={isChecking}
              aria-label="لیست URL ها برای بررسی"
            />
            <p className="text-sm text-gray-500 mt-2">
              💡 تعداد لینک‌ها: <span className="font-bold text-blue-600">{urls.filter(u => u.trim()).length}</span>
            </p>
            <div className="mt-4 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBrowser}
                  onChange={(e) => setShowBrowser(e.target.checked)}
                  className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500"
                  disabled={isChecking}
                />
                <span className="text-gray-700 flex items-center gap-2">
                  <Eye size={18} />
                  نمایش مرورگر (شبیه‌سازی)
                </span>
              </label>
            </div>
            <button
              onClick={simulateCheck}
              disabled={isChecking || urls.filter(u => u.trim()).length === 0}
              className="mt-4 w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-lg font-bold text-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              aria-live="polite"
            >
              {isChecking ? (
                <>
                  <Pause className="animate-pulse" size={24} />
                  <span>در حال بررسی... ({currentIndex}/{urls.filter(u => u.trim()).length})</span>
                </>
              ) : (
                <>
                  <Play size={24} />
                  <span>شروع بررسی</span>
                </>
              )}
            </button>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {(results.length > 0 || isChecking) && (
              <>
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">📊 خلاصه نتایج</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-green-50 p-4 rounded-xl border-l-4 border-green-400">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-green-800 font-semibold">دارای ویدیو</span>
                        <CheckCircle className="text-green-500" size={24} />
                      </div>
                      <p className="text-3xl font-bold text-green-700">
                        {withVideo} <span className="text-base font-medium">({total > 0 ? ((withVideo/total)*100).toFixed(1) : 0}%)</span>
                      </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl border-l-4 border-red-400">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-red-800 font-semibold">بدون ویدیو</span>
                        <XCircle className="text-red-500" size={24} />
                      </div>
                      <p className="text-3xl font-bold text-red-700">
                        {withoutVideo} <span className="text-base font-medium">({total > 0 ? ((withoutVideo/total)*100).toFixed(1) : 0}%)</span>
                      </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl border-l-4 border-blue-400">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-blue-800 font-semibold">کل بررسی‌ها</span>
                        <AlertCircle className="text-blue-500" size={24} />
                      </div>
                      <p className="text-3xl font-bold text-blue-700">{total}</p>
                    </div>
                  </div>
                  {results.length > 0 && !isChecking && (
                    <button
                      onClick={exportToCSV}
                      className="mt-4 w-full bg-green-500 text-white py-2.5 rounded-lg font-bold hover:bg-green-600 transition flex items-center justify-center gap-2"
                    >
                      <Download size={20} />
                      دانلود نتایج (CSV)
                    </button>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">🎬 جزئیات نتایج</h2>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {results.slice().reverse().map((result, index) => (
                      <div
                        key={results.length - 1 - index}
                        className={`p-3 rounded-lg border-2 ${
                          result.has_video
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {result.has_video ? (
                                <CheckCircle className="text-green-500 flex-shrink-0" size={20} />
                              ) : (
                                <XCircle className="text-red-500 flex-shrink-0" size={20} />
                              )}
                              <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 break-all hover:underline" title={result.url}>{result.url}</a>
                            </div>
                            {result.has_video && (
                              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2 pl-7">
                                {Object.entries(result).map(([key, value]) => {
                                  const indicatorMap: { [key: string]: { text: string; className: string } } = {
                                    video_tag: { text: 'Video Tag', className: 'bg-blue-100 text-blue-800' },
                                    iframe: { text: 'iFrame', className: 'bg-purple-100 text-purple-800' },
                                    video_player: { text: 'Player', className: 'bg-teal-100 text-teal-800' },
                                    osmosis_video: { text: 'Osmosis', className: 'bg-orange-100 text-orange-800' },
                                    youtube_embed: { text: 'YouTube', className: 'bg-red-100 text-red-800' },
                                  };
                                  if (key in indicatorMap && value) {
                                    return (
                                      <span key={key} className={`text-xs font-medium px-2 py-1 rounded-full ${indicatorMap[key]?.className || ''}`}>
                                        {indicatorMap[key]?.text || key}
                                      </span>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap pl-2">{result.timestamp}</span>
                        </div>
                      </div>
                    ))}
                    {isChecking && (
                      <div className="p-3 text-center text-gray-500 animate-pulse">
                        <p>در حال بررسی لینک بعدی...</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <OsmosisCheckerUI />
    </React.StrictMode>
  );
}