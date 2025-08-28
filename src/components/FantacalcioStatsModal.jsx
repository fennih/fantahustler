import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Target, Shield, Zap, Award, AlertCircle, RefreshCw } from 'lucide-react';
import { fantacalcioStatsApi } from '../services/fantacalcioStatsApi';

const FantacalcioStatsModal = ({ 
  isOpen, 
  onClose, 
  player 
}) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && player) {
      loadPlayerStats();
    }
  }, [isOpen, player]);

  const loadPlayerStats = async () => {
    if (!player) return;

    setLoading(true);
    setError(null);
    
    try {
      console.log(`🔍 Caricamento stats per ${player.nome} (${player.squadra})`);
      
      const rawStats = await fantacalcioStatsApi.getPlayerStats(
        player.nome, 
        player.squadra
      );
      
      const formattedStats = fantacalcioStatsApi.formatStatsForDisplay(rawStats);
      setStats(formattedStats);
      
    } catch (error) {
      console.error('❌ Errore caricamento stats:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color = "blue" }) => (
    <div className={`bg-${color}-50 border border-${color}-200 rounded-lg p-3`}>
      <div className="flex items-center space-x-2 mb-2">
        <Icon size={16} className={`text-${color}-600`} />
        <h4 className={`text-sm font-medium text-${color}-900`}>{title}</h4>
      </div>
      <div className={`text-2xl font-bold text-${color}-700`}>{value}</div>
      {subtitle && (
        <div className={`text-xs text-${color}-600 mt-1`}>{subtitle}</div>
      )}
    </div>
  );

  const ProgressBar = ({ value, max, label, color = "blue" }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    
    return (
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-700">{label}</span>
          <span className="font-medium">{value}/{max}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`bg-${color}-500 h-2 rounded-full transition-all duration-300`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">📊 Statistiche Fantacalcio</h2>
              {player && (
                <p className="text-blue-100 text-sm">
                  {player.nome} • {player.squadra} • Serie A 2024-25
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <RefreshCw className="animate-spin mx-auto mb-4 text-blue-500" size={32} />
                <p className="text-gray-600">Caricamento statistiche FBref...</p>
                <p className="text-sm text-gray-500 mt-2">
                  Recupero dati da fbref.com per {player?.nome}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="text-red-500" size={20} />
                <div>
                  <h3 className="font-medium text-red-900">Errore nel caricamento</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                  <button
                    onClick={loadPlayerStats}
                    className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors"
                  >
                    🔄 Riprova
                  </button>
                </div>
              </div>
            </div>
          )}

          {stats && !loading && (
            <div className="space-y-6">
              {/* Statistiche Principali */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Award className="mr-2 text-yellow-500" size={20} />
                  Statistiche Principali
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Per i portieri mostra statistiche diverse */}
                  {stats.goalkeeperStats && stats.goalkeeperStats.partiteGiocate > 0 ? (
                    <>
                      <StatCard
                        icon={Target}
                        title="Partite"
                        value={stats.mainStats.partite_giocate || stats.goalkeeperStats.partiteGiocate}
                        subtitle="Giocate"
                        color="blue"
                      />
                      <StatCard
                        icon={Shield}
                        title="Clean Sheets"
                        value={stats.goalkeeperStats.cleanSheets}
                        subtitle={`${stats.goalkeeperStats.percentualeCleanSheets}%`}
                        color="green"
                      />
                      <StatCard
                        icon={TrendingUp}
                        title="Parate"
                        value={stats.goalkeeperStats.parate}
                        subtitle={`${stats.goalkeeperStats.percentualeParate}%`}
                        color="purple"
                      />
                      <StatCard
                        icon={Zap}
                        title="Gol Subiti"
                        value={stats.goalkeeperStats.golSubiti}
                        subtitle={`${stats.goalkeeperStats.golSubitiPer90}/90min`}
                        color="red"
                      />
                    </>
                  ) : (
                    <>
                      <StatCard
                        icon={Target}
                        title="Gol"
                        value={stats.mainStats.gol}
                        subtitle={`${stats.mainStats.partite} partite`}
                        color="green"
                      />
                      <StatCard
                        icon={Zap}
                        title="Assist"
                        value={stats.mainStats.assist}
                        subtitle={`${Math.round(stats.mainStats.minuti/90)} x 90min`}
                        color="blue"
                      />
                      <StatCard
                        icon={TrendingUp}
                        title="xG"
                        value={stats.shootingStats.expectedGoals.toFixed(2)}
                        subtitle="Expected Goals"
                        color="purple"
                      />
                      <StatCard
                        icon={TrendingUp}
                        title="xAG"
                        value={stats.passingStats.expectedAssists.toFixed(2)}
                        subtitle="Expected Assists"
                        color="indigo"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Performance Fantacalcio */}
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  🏆 Valutazione Fantacalcio
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">
                      {stats.evaluation.scoreFantacalcio}
                    </div>
                    <div className="text-sm text-gray-600">Score Fantacalcio</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {stats.evaluation.expectedPerformance.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">Expected Performance</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-xl font-bold ${
                      stats.evaluation.efficienza === 'Alta' ? 'text-green-600' :
                      stats.evaluation.efficienza === 'Media' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {stats.evaluation.efficienza}
                    </div>
                    <div className="text-sm text-gray-600">Efficienza</div>
                  </div>
                </div>
              </div>

              {/* Statistiche Tiro - Solo per giocatori di movimento */}
              {!(stats.goalkeeperStats && stats.goalkeeperStats.partiteGiocate > 0) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    🎯 Statistiche Tiro
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <ProgressBar
                        value={stats.shootingStats.tiriInPorta}
                        max={stats.shootingStats.tiriTotali}
                        label="Tiri in Porta"
                        color="green"
                      />
                      <ProgressBar
                        value={stats.mainStats.gol}
                        max={Math.max(stats.shootingStats.expectedGoals, stats.mainStats.gol)}
                        label="Gol vs Expected"
                        color="blue"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <StatCard
                        icon={Target}
                        title="Precisione"
                        value={`${stats.shootingStats.precisioneTiro}%`}
                        color="green"
                      />
                      <StatCard
                        icon={TrendingUp}
                        title="xG/90"
                        value={stats.shootingStats.expectedGoalsPer90.toFixed(2)}
                        color="purple"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Statistiche Passaggi - Per tutti i giocatori */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  🎨 {stats.goalkeeperStats && stats.goalkeeperStats.partiteGiocate > 0 ? 'Distribuzione' : 'Creatività e Passaggi'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    icon={Award}
                    title="Precisione"
                    value={`${stats.passingStats.percentualePassaggi}%`}
                    subtitle="Passaggi riusciti"
                    color="yellow"
                  />
                  <StatCard
                    icon={Target}
                    title="Passaggi Totali"
                    value={stats.passingStats.passaggiProgressivi}
                    subtitle="Tentati"
                    color="blue"
                  />
                  {!(stats.goalkeeperStats && stats.goalkeeperStats.partiteGiocate > 0) && (
                    <>
                      <StatCard
                        icon={Zap}
                        title="Key Passes"
                        value={stats.passingStats.keyPasses}
                        subtitle="Passaggi chiave"
                        color="indigo"
                      />
                      <StatCard
                        icon={TrendingUp}
                        title="Pass in Area"
                        value={stats.passingStats.passaggiArea}
                        subtitle="Zona offensiva"
                        color="green"
                      />
                    </>
                  )}
                  {(stats.goalkeeperStats && stats.goalkeeperStats.partiteGiocate > 0) && (
                    <>
                      <StatCard
                        icon={TrendingUp}
                        title="Pass Lunghi"
                        value={stats.passingStats.passaggiArea}
                        subtitle="Distribuzione"
                        color="green"
                      />
                      <StatCard
                        icon={Zap}
                        title="xAG"
                        value={stats.passingStats.expectedAssists.toFixed(2)}
                        subtitle="Expected Assists"
                        color="purple"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Statistiche Difensive - Solo per giocatori di movimento */}
              {!(stats.goalkeeperStats && stats.goalkeeperStats.partiteGiocate > 0) && 
               (stats.defenseStats.tackle > 0 || stats.defenseStats.intercetti > 0) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Shield className="mr-2 text-blue-500" size={20} />
                    Statistiche Difensive
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      icon={Shield}
                      title="Tackle"
                      value={stats.defenseStats.tackle}
                      subtitle={`${stats.defenseStats.tacklePer90}/90min`}
                      color="blue"
                    />
                    <StatCard
                      icon={Target}
                      title="Intercetti"
                      value={stats.defenseStats.intercetti}
                      subtitle={`${stats.defenseStats.intercettiPer90}/90min`}
                      color="green"
                    />
                  </div>
                </div>
              )}

              {/* Statistiche Portiere */}
              {stats.goalkeeperStats && stats.goalkeeperStats.partiteGiocate > 0 && (
                <div className="bg-gradient-to-r from-yellow-50 to-green-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    🥅 Statistiche Portiere
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <StatCard
                      icon={Shield}
                      title="Clean Sheets"
                      value={stats.goalkeeperStats.cleanSheets}
                      subtitle={`${stats.goalkeeperStats.percentualeCleanSheets}%`}
                      color="green"
                    />
                    <StatCard
                      icon={Target}
                      title="Parate"
                      value={stats.goalkeeperStats.parate}
                      subtitle={`${stats.goalkeeperStats.percentualeParate}%`}
                      color="blue"
                    />
                    <StatCard
                      icon={TrendingUp}
                      title="Gol Subiti"
                      value={stats.goalkeeperStats.golSubiti}
                      subtitle={`${stats.goalkeeperStats.golSubitiPer90}/90min`}
                      color="red"
                    />
                    <StatCard
                      icon={Award}
                      title="Vittorie"
                      value={stats.goalkeeperStats.vittorie}
                      subtitle={`${stats.goalkeeperStats.partiteGiocate} partite`}
                      color="yellow"
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <ProgressBar
                      value={stats.goalkeeperStats.parate}
                      max={stats.goalkeeperStats.tiriSubiti}
                      label="Parate Efficaci"
                      color="blue"
                    />
                    <ProgressBar
                      value={stats.goalkeeperStats.cleanSheets}
                      max={stats.goalkeeperStats.partiteGiocate}
                      label="Clean Sheets"
                      color="green"
                    />
                    {stats.goalkeeperStats.rigoriAffrontati > 0 && (
                      <ProgressBar
                        value={stats.goalkeeperStats.rigoriParati}
                        max={stats.goalkeeperStats.rigoriAffrontati}
                        label="Rigori Parati"
                        color="purple"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Disciplina */}
              {(stats.mainStats.cartelliniGialli > 0 || stats.mainStats.cartelliniRossi > 0) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    ⚠️ Disciplina
                  </h3>
                  <div className="flex space-x-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-6 bg-yellow-400 rounded-sm"></div>
                      <span className="font-medium">{stats.mainStats.cartelliniGialli}</span>
                      <span className="text-sm text-gray-600">Gialli</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-6 bg-red-500 rounded-sm"></div>
                      <span className="font-medium">{stats.mainStats.cartelliniRossi}</span>
                      <span className="text-sm text-gray-600">Rossi</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-3 border-t">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              📊 Dati da FBref.com • Serie A 2024-25
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FantacalcioStatsModal;
