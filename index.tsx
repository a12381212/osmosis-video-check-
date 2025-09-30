/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Play, Pause, Download, Link, CheckCircle, XCircle, AlertCircle, Eye, ArrowUpDown, Search, Copy, ExternalLink } from 'lucide-react';

type Result = {
    url: string;
    has_video: boolean;
    status: string;
    timestamp: string;
    detection_method: string;
    playback_speed_button: number;
    playback_speed_button_element: string | null;
    video_tag: number;
    iframe: number;
    youtube_embed: number;
};


function OsmosisCheckerUI() {
  const [urls, setUrls] = useState<string[]>([
    'https://www.osmosis.org/learn/Introduction_to_the_somatic_and_autonomic_nervous_systems',
    'https://www.osmosis.org/learn/Anatomy_clinical_correlates:_Female_pelvis_and_perineum',
    'https://www.osmosis.org/learn/Ebola_virus',
    'https://www.osmosis.org/notes/Abdominal_aortic_aneurysm', // This is a note, not a video
    'https://www.osmosis.org/learn/Overview_of_the_eye', // This is a video
  ]);
  const [results, setResults] = useState<Result[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBrowser, setShowBrowser] = useState(true);

  // State for filtering and sorting
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterUrl, setFilterUrl] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Result; direction: 'ascending' | 'descending' } | null>(null);
  const [copyButtonText, setCopyButtonText] = useState('کپی کردن لینک‌ها');

  const fetchWithFallbacks = async (url: string, timeout = 20000) => {
    const proxies = [
      `https://cors.sh/${url}`,
      `https://corsproxy.io/?${encodeURIComponent(url)}`
    ];
  
    let lastError: Error | null = null;
  
    for (const proxyUrl of proxies) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
  
        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          return response; // Success! Return the response object
        }
        lastError = new Error(`خطای HTTP: ${response.status}`);
      } catch (error: any) {
        lastError = error;
        // Continue to the next proxy
      }
    }
  
    // If all proxies fail, throw the last encountered error
    throw lastError || new Error('All CORS proxies failed');
  };

  const startCheck = async () => {
    const validUrls = urls.filter(url => url.trim() !== '');
    if (validUrls.length === 0) return;

    setIsChecking(true);
    setResults([]);
    setCurrentIndex(0);

    for (let i = 0; i < validUrls.length; i++) {
      const url = validUrls[i];
      setCurrentIndex(i + 1);

      let result: Result;
      try {
        const response = await fetchWithFallbacks(url, 20000);

        if (!response) {
            throw new Error('پاسخی از پراکسی دریافت نشد');
        }

        const html = await response.text();
        
        let hasVideo = false;
        let detectionMethod = 'Not Found';
        let playbackElementSnippet: string | null = null;

        // Tier 1: Most reliable method - Parse __NEXT_DATA__
        const nextDataRegex = /<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/;
        const nextDataMatch = html.match(nextDataRegex);

        if (nextDataMatch && nextDataMatch[1]) {
          try {
            const nextData = JSON.parse(nextDataMatch[1]);
            const contentType = nextData?.props?.pageProps?.page?.content?.__typename;
            if (contentType === 'Video') {
              hasVideo = true;
              detectionMethod = '__NEXT_DATA__ (Video)';
            } else if (contentType) {
              detectionMethod = `__NEXT_DATA__ (${contentType})`;
            }
          } catch (e) {
            console.error('Failed to parse __NEXT_DATA__ for', url);
          }
        }
        
        // Always calculate counts for diagnostic purposes
        const countMatches = (regex: RegExp) => (html.match(regex) || []).length;
        const playbackCount = countMatches(/playback-speed-button/g);
        const videoTagCount = countMatches(/<video/g);
        const iframeCount = countMatches(/<iframe/g);
        const youtubeCount = countMatches(/youtube\.com\/embed\//g);
        
        // Tier 2: Fallback checks if Tier 1 didn't confirm a video
        if (!hasVideo) {
          if (playbackCount > 0) {
            hasVideo = true;
            detectionMethod = 'Playback Speed Button';
            const playbackIdentifier = 'playback-speed-button';
            const matchIndex = html.indexOf(playbackIdentifier);
            if (matchIndex !== -1) {
                const tagStartIndex = html.lastIndexOf('<', matchIndex);
                const tagEndIndex = html.indexOf('>', tagStartIndex);
                if (tagStartIndex !== -1 && tagEndIndex > tagStartIndex) {
                    playbackElementSnippet = html.substring(tagStartIndex, tagEndIndex + 1);
                }
            }
          } else if (videoTagCount > 0) {
            hasVideo = true;
            detectionMethod = 'HTML5 <video> Tag';
          } else if (youtubeCount > 0) {
            hasVideo = true;
            detectionMethod = 'YouTube Embed';
          }
        }
        
        result = {
          url: url,
          has_video: hasVideo,
          status: 'موفق',
          timestamp: new Date().toLocaleString('fa-IR'),
          detection_method: detectionMethod,
          playback_speed_button: playbackCount,
          playback_speed_button_element: playbackElementSnippet,
          video_tag: videoTagCount,
          iframe: iframeCount,
          youtube_embed: youtubeCount,
        };
      } catch (error: any) {
        console.error(`Failed to check URL ${url}:`, error);
        let errorMessage = error.message;
        if (error.name === 'AbortError') {
            errorMessage = 'پاسخ‌دهی طولانی';
        } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('All CORS proxies failed')) {
            errorMessage = 'عدم امکان دسترسی از طریق پراکسی‌ها';
        }
        
        result = {
          url: url,
          has_video: false,
          status: `خطا: ${errorMessage}`,
          timestamp: new Date().toLocaleString('fa-IR'),
          detection_method: 'Error',
          playback_speed_button: 0,
          playback_speed_button_element: null,
          video_tag: 0,
          iframe: 0,
          youtube_embed: 0,
        };
      }
      
      setResults(prev => [...prev, result]);
    }

    setIsChecking(false);
    setCurrentIndex(0);
  };

  const sortedAndFilteredResults = useMemo(() => {
    let filterableResults = [...results];

    // Filtering logic
    filterableResults = filterableResults.filter(result => {
      const statusMatch =
        filterStatus === 'all' ||
        (filterStatus === 'yes' && result.has_video) ||
        (filterStatus === 'no' && !result.has_video && !result.status.startsWith('خطا')) ||
        (filterStatus === 'error' && result.status.startsWith('خطا'));

      const urlMatch = filterUrl === '' || result.url.toLowerCase().includes(filterUrl.toLowerCase());

      return statusMatch && urlMatch;
    });

    // Sorting logic
    if (sortConfig !== null) {
      filterableResults.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return filterableResults;
  }, [results, filterStatus, filterUrl, sortConfig]);
  
  const requestSort = (key: keyof Result) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const exportToCSV = () => {
    if (sortedAndFilteredResults.length === 0) return;

    const escapeCSV = (val: any) => {
        if (val === undefined || val === null) {
            return '';
        }
        let str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            str = `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const headers = ['URL', 'Has Video', 'Status', 'Detection Method', 'Timestamp', 'Playback Speed Button Count', 'Video Tag Count', 'iFrame Count', 'YouTube Embed Count', 'Playback Speed Button Element'];
    const rows = sortedAndFilteredResults.map(r => [
      escapeCSV(r.url),
      escapeCSV(r.has_video ? 'true' : 'false'),
      escapeCSV(r.status),
      escapeCSV(r.detection_method),
      escapeCSV(r.timestamp),
      escapeCSV(r.playback_speed_button),
      escapeCSV(r.video_tag),
      escapeCSV(r.iframe),
      escapeCSV(r.youtube_embed),
      escapeCSV(r.playback_speed_button_element),
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'osmosis_results.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLinks = () => {
    const links = sortedAndFilteredResults.map(r => r.url).join('\n');
    if (!links) return;
    navigator.clipboard.writeText(links).then(() => {
        setCopyButtonText('کپی شد!');
        setTimeout(() => setCopyButtonText('کپی کردن لینک‌ها'), 2000);
    });
  };

  const handleOpenLinks = () => {
    const links = sortedAndFilteredResults.map(r => r.url);
    if (links.length === 0) return;
    
    if (window.confirm(`آیا مطمئن هستید که می‌خواهید ${links.length} لینک را در تب‌های جدید باز کنید؟`)) {
        links.forEach(link => {
            window.open(link, '_blank', 'noopener,noreferrer');
        });
    }
  };

  const withVideo = results.filter(r => r.has_video).length;
  const withoutVideo = results.filter(r => !r.has_video && r.status === 'موفق').length;
  const errors = results.filter(r => r.status.startsWith('خطا')).length;
  const total = results.length;
  
  const SortableHeader = ({ columnKey, children }: { columnKey: keyof Result, children: React.ReactNode }) => {
    const isSorting = sortConfig?.key === columnKey;
    return (
      <th scope="col" className="px-6 py-3">
        <button onClick={() => requestSort(columnKey)} className="flex items-center gap-1.5 group font-bold">
          {children}
          <ArrowUpDown size={14} className={isSorting ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'} />
        </button>
      </th>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 border-t-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-bold text-gray-800">بررسی ویدیوهای Osmosis</h1>
            <Play className="text-blue-500" size={40} />
          </div>
          <p className="text-gray-600 text-lg">تشخیص هوشمند نوع محتوای صفحه (ویدیو یا غیره)</p>
        </div>

        {/* URL Input Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Link size={24} className="text-blue-500" />
              لینک‌های مورد بررسی
            </h2>
          </div>

          <div className="mb-3">
            <textarea
              value={urls.join('\n')}
              onChange={(e) => setUrls(e.target.value.split('\n'))}
              placeholder="هر لینک را در یک خط وارد کنید:&#10;https://www.osmosis.org/learn/Development_of_the_integumentary_system&#10;https://www.osmosis.org/learn/Abdominal_quadrants&#10;https://www.osmosis.org/learn/..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm min-h-[200px]"
              disabled={isChecking}
              aria-label="لیست URL ها برای بررسی"
            />
            <p className="text-sm text-gray-500 mt-2">
              💡 تعداد لینک‌ها: <span className="font-bold text-blue-600">{urls.filter(u => u.trim()).length}</span>
            </p>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-700">
              <strong>روش تشخیص:</strong> بررسی داده‌های ساختاری صفحه (<code className="bg-blue-100 px-1 rounded">__NEXT_DATA__</code>) و نشانه‌های دیگر.
            </p>
          </div>
          
          <div className="mt-4 flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showBrowser}
                onChange={(e) => setShowBrowser(e.target.checked)}
                className="w-5 h-5 text-blue-500 rounded"
                disabled={isChecking}
              />
              <span className="text-gray-700 flex items-center gap-2">
                <Eye size={18} />
                نمایش مرورگر (غیرفعال)
              </span>
            </label>
          </div>

          <button
            onClick={startCheck}
            disabled={isChecking || urls.filter(u => u.trim()).length === 0}
            className="mt-4 w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-4 rounded-lg font-bold text-lg hover:from-blue-600 hover:to-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
             aria-live="polite"
          >
            {isChecking ? (
              <>
                <Pause className="animate-pulse" size={24} />
                در حال بررسی... ({currentIndex}/{urls.filter(u => u.trim()).length})
              </>
            ) : (
              <>
                <Play size={24} />
                شروع بررسی
              </>
            )}
          </button>
        </div>

        {results.length > 0 && (
          <>
            {/* Summary */}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">📊 خلاصه نتایج</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border-2 border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-green-700 font-semibold">دارای ویدیو</span>
                    <CheckCircle className="text-green-500" size={24} />
                  </div>
                  <div className="text-3xl font-bold text-green-700">
                    {withVideo} <span className="text-lg">({total > 0 ? ((withVideo/total)*100).toFixed(1) : 0}%)</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-xl border-2 border-yellow-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-yellow-700 font-semibold">بدون ویدیو</span>
                    <XCircle className="text-yellow-500" size={24} />
                  </div>
                  <div className="text-3xl font-bold text-yellow-700">
                    {withoutVideo} <span className="text-lg">({total > 0 ? ((withoutVideo/total)*100).toFixed(1) : 0}%)</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border-2 border-red-200">
                   <div className="flex items-center justify-between mb-2">
                    <span className="text-red-700 font-semibold">خطاها</span>
                    <AlertCircle className="text-red-500" size={24} />
                  </div>
                  <div className="text-3xl font-bold text-red-700">{errors}</div>
                </div>
              </div>

              <button
                onClick={exportToCSV}
                className="mt-4 w-full bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600 transition flex items-center justify-center gap-2"
              >
                <Download size={20} />
                دانلود نتایج فیلتر شده (CSV)
              </button>
            </div>

            {/* Detailed Results Table */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">🎬 جزئیات نتایج ({sortedAndFilteredResults.length} مورد)</h2>
              
              {/* Filter Controls */}
              <div className="flex flex-col md:flex-row gap-4 mb-4 py-4 border-y">
                <div className="flex items-center gap-2">
                    <label htmlFor="status-filter" className="text-sm font-medium text-gray-700 shrink-0">فیلتر وضعیت:</label>
                    <select id="status-filter" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full md:w-auto bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5">
                        <option value="all">همه</option>
                        <option value="yes">دارای ویدیو</option>
                        <option value="no">بدون ویدیو</option>
                        <option value="error">خطا</option>
                    </select>
                </div>
                <div className="relative flex-grow">
                    <label htmlFor="url-search" className="sr-only">جستجوی URL</label>
                    <input
                        type="text"
                        id="url-search"
                        placeholder="جستجو در URL..."
                        value={filterUrl}
                        onChange={e => setFilterUrl(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Search size={18} className="text-gray-400" />
                    </div>
                </div>
              </div>
              
              {/* Filtered Links Actions */}
              {sortedAndFilteredResults.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg border my-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">عملیات روی لینک‌های فیلتر شده</h3>
                  <textarea
                    readOnly
                    value={sortedAndFilteredResults.map(r => r.url).join('\n')}
                    className="w-full h-32 p-2 border border-gray-300 rounded-md font-mono text-xs bg-gray-100 focus:outline-none"
                    aria-label="لیست لینک‌های فیلتر شده"
                  />
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={handleCopyLinks}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-semibold"
                    >
                      <Copy size={16} />
                      {copyButtonText}
                    </button>
                    <button
                      onClick={handleOpenLinks}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition font-semibold"
                    >
                      <ExternalLink size={16} />
                      باز کردن همه در تب جدید
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto relative rounded-lg border">
                <table className="w-full text-sm text-right text-gray-600">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                    <tr>
                      <th scope="col" className="px-6 py-3 font-bold">#</th>
                      <SortableHeader columnKey="url">URL</SortableHeader>
                      <SortableHeader columnKey="has_video">دارای ویدیو</SortableHeader>
                      <SortableHeader columnKey="status">وضعیت</SortableHeader>
                      <SortableHeader columnKey="detection_method">روش تشخیص</SortableHeader>
                      <SortableHeader columnKey="timestamp">زمان</SortableHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAndFilteredResults.map((result, index) => (
                      <tr key={result.url + index} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{index + 1}</td>
                        <td className="px-6 py-4 max-w-xs">
                          <a href={result.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline truncate block" title={result.url}>
                            {result.url}
                          </a>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              result.status.startsWith('خطا')
                                ? 'bg-gray-100 text-gray-600'
                                : result.has_video
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {result.status.startsWith('خطا') ? (
                              <XCircle size={14} />
                            ) : result.has_video ? (
                              <CheckCircle size={14} />
                            ) : (
                              <XCircle size={14} />
                            )}
                            {result.status.startsWith('خطا') ? 'N/A' : result.has_video ? 'true' : 'false'}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`font-semibold ${
                             result.status.startsWith('خطا') ? 'text-red-600' : 'text-gray-700'
                           }`}>
                             {result.status}
                           </span>
                        </td>
                        <td className="px-6 py-4">{result.detection_method}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{result.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sortedAndFilteredResults.length === 0 && (
                  <div className="text-center py-10 text-gray-500">
                    <p className="font-semibold">هیچ موردی با فیلترهای اعمال شده یافت نشد.</p>
                    <p className="text-sm mt-1">لطفاً فیلترها را تغییر دهید یا حذف کنید.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
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