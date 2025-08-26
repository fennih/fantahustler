// Componente Modal per visualizzare statistiche FBRef
import React, { useState, useEffect } from 'react';
import { X, ExternalLink, TrendingUp, Clock, MapPin, Award } from 'lucide-react';
import FBRefScraper from '../utils/fbrefScraper.js';

const PlayerStatsModal = ({ isOpen, onClose, giocatore }) => {
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [fbrefUrl, setFbrefUrl] = useState('');

  const scraper = new FBRefScraper({
    rateLimit: 3000, // Prudente per produzione
    maxRetries: 2
  });

  // Reset quando cambia giocatore o si apre il modal
  useEffect(() => {
    if (isOpen) {
      setStatsData(null);
      setError(null);
      setSelectedTab('overview');
      setFbrefUrl('');
    }
  }, [isOpen, giocatore?.id]);

  const loadPlayerStats = async () => {
    if (!fbrefUrl.trim()) {
      setError('Inserisci un URL FBRef valido');
      return;
    }

    // Validazione URL semplice
    if (!fbrefUrl.includes('fbref.com')) {
      setError('L\'URL deve essere di FBRef (fbref.com)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`📊 Loading FBRef stats from URL: ${fbrefUrl}`);
      
      // Usa direttamente l'URL fornito
      const playerData = await scraper.getPlayerStats(fbrefUrl);
      
      setStatsData(playerData);
      console.log('✅ Stats loaded successfully');

    } catch (err) {
      console.error('❌ Error loading stats:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatMinutes = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toLocaleString()}h ${mins}m`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {giocatore?.nome || 'Player Stats'}
              </h2>
              <p className="text-sm text-gray-600">
                {giocatore?.squadra} • Statistiche da FBRef
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* URL Input Section */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="space-y-3">
            <div>
              <label htmlFor="fbref-url" className="block text-sm font-medium text-gray-700 mb-1">
                URL FBRef del giocatore
              </label>
              <div className="flex space-x-2">
                <input
                  id="fbref-url"
                  type="url"
                  value={fbrefUrl}
                  onChange={(e) => setFbrefUrl(e.target.value)}
                  placeholder="https://fbref.com/en/players/f7036e1c/dom_lg/Lautaro-Martinez..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <button
                  onClick={loadPlayerStats}
                  disabled={loading || !fbrefUrl.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {loading ? '⏳' : '📊'} Carica Stats
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              💡 <strong>Come trovare l'URL:</strong> Vai su{' '}
              <a href="https://fbref.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                fbref.com
              </a>, cerca il giocatore e copia l'URL della sua pagina (es. Martinez L.: https://fbref.com/en/players/...)
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-160px)]">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <p className="text-gray-600">Caricamento statistiche da FBRef...</p>
                <p className="text-xs text-gray-400">Questo può richiedere alcuni secondi</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <div className="text-red-600 font-medium">Errore nel caricamento</div>
                </div>
                <p className="text-red-700 text-sm mt-2">{error}</p>
                {fbrefUrl && (
                  <button
                    onClick={loadPlayerStats}
                    className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                  >
                    Riprova
                  </button>
                )}
              </div>
            </div>
          )}

          {!loading && !error && !statsData && (
            <div className="p-6">
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Statistiche da FBRef
                </h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Inserisci l'URL FBRef del giocatore qui sopra per visualizzare 
                  le sue statistiche dettagliate e la carriera completa.
                </p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-sm text-orange-800 mb-2">
                    <strong>⚠️ Nota:</strong>
                  </p>
                  <p className="text-xs text-orange-700">
                    FBRef può bloccare le richieste automatizzate (errore 403). 
                    Se questo accade, prova con un URL diverso o attendi qualche minuto.
                  </p>
                </div>
              </div>
            </div>
          )}

          {statsData && (
            <div className="p-6">
              {/* Tabs */}
              <div className="flex border-b border-gray-200 mb-6">
                {[
                  { id: 'overview', label: 'Panoramica', icon: TrendingUp },
                  { id: 'career', label: 'Carriera', icon: Clock },
                  { id: 'seasons', label: 'Stagioni', icon: Award }
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setSelectedTab(id)}
                    className={`flex items-center space-x-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                      selectedTab === id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {selectedTab === 'overview' && (
                <div className="space-y-6">
                  {/* Player Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Informazioni Giocatore</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Nome Completo:</span>
                          <span className="font-medium">{statsData.playerInfo.fullName || statsData.playerInfo.name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Posizione:</span>
                          <span className="font-medium">{statsData.playerInfo.position || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Squadra Attuale:</span>
                          <span className="font-medium">{statsData.playerInfo.currentTeam || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Nazionalità:</span>
                          <span className="font-medium">{statsData.playerInfo.nationality || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Età:</span>
                          <span className="font-medium">{statsData.playerInfo.age || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Altezza:</span>
                          <span className="font-medium">{statsData.playerInfo.height || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Peso:</span>
                          <span className="font-medium">{statsData.playerInfo.weight || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Piede:</span>
                          <span className="font-medium">{statsData.playerInfo.foot || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Career Totals */}
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Totali Carriera</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600">
                            {statsData.careerStats.totals.matches || 0}
                          </div>
                          <div className="text-sm text-gray-600">Partite</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-green-600">
                            {statsData.careerStats.totals.goals || 0}
                          </div>
                          <div className="text-sm text-gray-600">Gol</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-purple-600">
                            {statsData.careerStats.totals.assists || 0}
                          </div>
                          <div className="text-sm text-gray-600">Assist</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-orange-600">
                            {formatMinutes(statsData.careerStats.totals.minutes)}
                          </div>
                          <div className="text-sm text-gray-600">Minuti</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Link to FBRef */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Fonte Dati</h3>
                        <p className="text-xs text-gray-600">
                          Statistiche aggiornate al {formatDate(statsData.scrapedAt)}
                        </p>
                      </div>
                      <a
                        href={statsData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                      >
                        <ExternalLink size={16} />
                        <span>Vedi su FBRef</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {selectedTab === 'career' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistiche Carriera Dettagliate</h3>
                  {/* TODO: Implementa statistiche dettagliate */}
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <p className="text-gray-600">Statistiche dettagliate in sviluppo...</p>
                  </div>
                </div>
              )}

              {selectedTab === 'seasons' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Stagioni</h3>
                  
                  {statsData.careerStats.seasons.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stagione</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Età</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Squadra</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campionato</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Partite</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Titolare</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Minuti</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Gol</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Assist</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {statsData.careerStats.seasons.reverse().map((season, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{season.season}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{season.age || 'N/A'}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{season.team}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{season.league}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-center">{season.matches}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-center">{season.starts}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-center">{season.minutes.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-center font-semibold text-green-600">{season.goals}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-center font-semibold text-purple-600">{season.assists}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <p className="text-gray-600">Nessuna statistica stagionale disponibile</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerStatsModal;
