/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Play, Pause, Download, Link, CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react';

function OsmosisCheckerUI() {
  const [urls, setUrls] = useState<string[]>([
    'https://www.osmosis.org/learn/Introduction_to_the_somatic_and_autonomic_nervous_systems',
    'https://www.osmosis.org/learn/Anatomy_clinical_correlates:_Female_pelvis_and_perineum',
    'https://www.osmosis.org/learn/Ebola_virus',
    'https://www.osmosis.org/notes/Abdominal_aortic_aneurysm', // This is a note, not a video
    'https://www.osmosis.org/learn/Overview_of_the_eye', // This is a video
  ]);
  const [results, setResults] = useState<any[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBrowser, setShowBrowser] = useState(true);

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

      let result;
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

  const exportToCSV = () => {
    if (results.length === 0) return;

    const escapeCSV = (val: any) => {
        if (val === undefined || val === null) {
            return '';
        }
        let str = String(val);
        // If the string contains a comma, a double quote, or a newline, wrap it in double quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            // Escape any existing double quotes by doubling them
            str = `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const headers = ['URL', 'Has Video', 'Status', 'Detection Method', 'Timestamp', 'Playback Speed Button Count', 'Video Tag Count', 'iFrame Count', 'YouTube Embed Count', 'Playback Speed Button Element'];
    const rows = results.map(r => [
      escapeCSV(r.url),
      escapeCSV(r.has_video ? 'Yes' : 'No'),
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

  const withVideo = results.filter(r => r.has_video).length;
  const withoutVideo = results.filter(r => !r.has_video && r.status === 'موفق').length;
  const errors = results.filter(r => r.status.startsWith('خطا')).length;
  const total = results.length;

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

          {/* Info Box */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-700">
              <strong>روش تشخیص:</strong> بررسی داده‌های ساختاری صفحه (<code className="bg-blue-100 px-1 rounded">__NEXT_DATA__</code>) و نشانه‌های دیگر.
            </p>
          </div>

          {/* Options */}
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

          {/* Start Button */}
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

        {/* Results Section */}
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
                دانلود نتایج (CSV)
              </button>
            </div>

            {/* Detailed Results */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">🎬 جزئیات نتایج</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 ${
                      result.status.startsWith('خطا') 
                        ? 'bg-red-50 border-red-200' 
                        : result.has_video
                          ? 'bg-green-50 border-green-200'
                          : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {result.status.startsWith('خطا') ? (
                             <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                          ) : result.has_video ? (
                            <CheckCircle className="text-green-500 flex-shrink-0" size={20} />
                          ) : (
                            <XCircle className="text-yellow-500 flex-shrink-0" size={20} />
                          )}
                          <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 break-all hover:underline" title={result.url}>{result.url}</a>
                        </div>
                        
                        <div className="mt-2 mb-2">
                          <span className={`text-xs px-2 py-1 rounded font-semibold ${
                            result.status.startsWith('خطا')
                              ? 'bg-red-200 text-red-800'
                              : result.has_video 
                                ? 'bg-green-200 text-green-800' 
                                : 'bg-gray-200 text-gray-600'
                          }`}>
                            {result.status.startsWith('خطا') ? result.status : result.detection_method}
                          </span>
                        </div>

                        {!result.status.startsWith('خطا') && (
                          <>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {result.playback_speed_button > 0 && (
                                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                                  ⚡ Speed Control ({result.playback_speed_button})
                                </span>
                              )}
                              {result.video_tag > 0 && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                  Video Tag ({result.video_tag})
                                </span>
                              )}
                              {result.iframe > 0 && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                  iFrame ({result.iframe})
                                </span>
                              )}
                              {result.youtube_embed > 0 && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                                  YouTube ({result.youtube_embed})
                                </span>
                              )}
                            </div>
                            {result.playback_speed_button_element && (
                              <div className="mt-2">
                                <p className="text-xs font-semibold text-gray-600 mb-1">کد المنت شناسایی شده:</p>
                                <pre className="bg-gray-100 p-2 rounded-md text-xs text-gray-800 overflow-x-auto font-mono">
                                  <code>
                                    {result.playback_speed_button_element}
                                  </code>
                                </pre>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap pl-2">{result.timestamp}</span>
                    </div>
                  </div>
                ))}
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
