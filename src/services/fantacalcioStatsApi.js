/**
 * API Service per Statistiche Fantacalcio
 * Integra con il backend SoccerData per recuperare stats FBref
 */

// 🚀 Vercel Serverless Functions
const VERCEL_API_URL = 'https://fantahustler-jnmi5e208-fennihs-projects.vercel.app/api';

// Railway backup (per fallback se necessario)
const RAILWAY_API_URL = 'https://fantahustler-production.up.railway.app/api';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? RAILWAY_API_URL  // 🎯 RAILWAY PRIMARY - Full FBref Stats & Reliable
  : 'http://localhost:5003/api';  // Locale per sviluppo

class FantacalcioStatsApi {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minuti
  }

  /**
   * Recupera statistiche complete di un giocatore
   */
  async getPlayerStats(playerName, teamName = null) {
    try {
      const cacheKey = `${playerName}_${teamName || 'no_team'}`;
      
      // Controlla cache
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          console.log(`📦 Cache hit per ${playerName}`);
          return cached.data;
        }
      }

      console.log(`🔍 Recupero stats per ${playerName} (${teamName || 'squadra auto'})`);
      
      // Costruisci URL
      const url = new URL(`${API_BASE_URL}/player-stats/${encodeURIComponent(playerName)}`);
      if (teamName) {
        url.searchParams.append('team', teamName);
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000 // 30 secondi timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Salva in cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      console.log(`✅ Stats recuperate per ${data.player?.name || playerName}`);
      return data;

    } catch (error) {
      console.error(`❌ Errore recupero stats per ${playerName}:`, error);
      throw error;
    }
  }

  /**
   * Verifica se il servizio backend è attivo
   */
  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      return data.status === 'ok';
    } catch (error) {
      console.error('❌ Backend non raggiungibile:', error);
      return false;
    }
  }

  /**
   * Forza il refresh della cache backend
   */
  async refreshBackendCache() {
    try {
      const response = await fetch(`${API_BASE_URL}/cache/refresh`, {
        method: 'POST'
      });
      return response.ok;
    } catch (error) {
      console.error('❌ Errore refresh cache:', error);
      return false;
    }
  }

  /**
   * Pulisce la cache locale
   */
  clearLocalCache() {
    this.cache.clear();
    console.log('🗑️ Cache locale pulita');
  }

  /**
   * Formatta le statistiche per la visualizzazione
   */
  formatStatsForDisplay(stats) {
    if (!stats || stats.error) {
      return null;
    }

    const { player, stats: fantacalcio_stats, fantacalcio_insights } = stats;
    
    return {
      player: {
        name: player.name,
        team: player.team,
        season: player.season
      },
      
      // 📊 Statistiche principali per il Fantacalcio
      mainStats: {
        partite: fantacalcio_stats.generale?.partite_giocate || 0,
        minuti: fantacalcio_stats.generale?.minuti_totali || 0,
        gol: fantacalcio_stats.generale?.gol || 0,
        assist: fantacalcio_stats.generale?.assist || 0,
        cartelliniGialli: fantacalcio_stats.generale?.cartellini_gialli || 0,
        cartelliniRossi: fantacalcio_stats.generale?.cartellini_rossi || 0
      },

      // 🎯 Statistiche avanzate tiro
      shootingStats: {
        expectedGoals: fantacalcio_stats.tiro?.expected_goals || 0,
        expectedGoalsPer90: fantacalcio_stats.tiro?.tiri_per_90min || 0,
        tiriTotali: fantacalcio_stats.tiro?.tiri_totali || 0,
        tiriInPorta: fantacalcio_stats.tiro?.tiri_in_porta || 0,
        precisioneTiro: fantacalcio_stats.tiro?.precisione_tiro || 0,
        golVsExpected: fantacalcio_stats.tiro?.gol_expected_goals || 0
      },

      // 🅰️ Statistiche passaggi e creatività
      passingStats: {
        expectedAssists: fantacalcio_stats.passaggi?.assist_attesi || 0,
        expectedAssistsPer90: fantacalcio_stats.passaggi?.passaggi_per_90min || 0,
        keyPasses: fantacalcio_stats.passaggi?.passaggi_chiave || 0,
        passaggiProgressivi: fantacalcio_stats.passaggi?.passaggi_totali || 0,
        passaggiArea: fantacalcio_stats.passaggi?.passaggi_riusciti || 0,
        percentualePassaggi: fantacalcio_stats.passaggi?.precisione_passaggi || 0
      },

      // 🛡️ Statistiche difensive
      defenseStats: {
        tackle: fantacalcio_stats.difesa?.tackle || 0,
        intercetti: fantacalcio_stats.difesa?.intercetti || 0,
        tacklePer90: fantacalcio_stats.difesa?.tackle_per_90min || 0,
        intercettiPer90: fantacalcio_stats.difesa?.percentuale_duelli_aerei || 0
      },

      // ⚽ Statistiche possesso
      possessionStats: {
        tocchi: fantacalcio_stats.possesso?.tocchi || 0,
        tocchiArea: fantacalcio_stats.possesso?.tocchi_area_rigore || 0,
        dribblingRiusciti: fantacalcio_stats.possesso?.dribbling_riusciti || 0,
        percentualeDribbling: fantacalcio_stats.possesso?.percentuale_dribbling || 0
      },

      // 🥅 Statistiche portiere (se disponibili)
      goalkeeperStats: {
        partiteGiocate: fantacalcio_stats.portiere?.partite_giocate || 0,
        partiteTitolare: fantacalcio_stats.portiere?.partite_da_titolare || 0,
        minutiGiocati: fantacalcio_stats.portiere?.minuti_giocati || 0,
        golSubiti: fantacalcio_stats.portiere?.gol_subiti || 0,
        golSubitiPer90: fantacalcio_stats.portiere?.gol_subiti_per_90min || 0,
        tiriSubiti: fantacalcio_stats.portiere?.tiri_subiti || 0,
        parate: fantacalcio_stats.portiere?.parate || 0,
        percentualeParate: fantacalcio_stats.portiere?.percentuale_parate || 0,
        cleanSheets: fantacalcio_stats.portiere?.clean_sheets || 0,
        percentualeCleanSheets: fantacalcio_stats.portiere?.percentuale_clean_sheets || 0,
        vittorie: fantacalcio_stats.portiere?.vittorie || 0,
        pareggi: fantacalcio_stats.portiere?.pareggi || 0,
        sconfitte: fantacalcio_stats.portiere?.sconfitte || 0,
        rigoriAffrontati: fantacalcio_stats.portiere?.rigori_affrontati || 0,
        rigoriParati: fantacalcio_stats.portiere?.rigori_parati || 0,
        percentualeRigoriParati: fantacalcio_stats.portiere?.percentuale_rigori_parati || 0
      },

      // 🏆 Valutazione Fantacalcio
      evaluation: {
        scoreFantacalcio: fantacalcio_insights?.voto_medio_stimato || 0,
        expectedPerformance: fantacalcio_insights?.bonus_malus_attesi || 0,
        efficienza: fantacalcio_insights?.affidabilita || 'Media'
      }
    };
  }
}

// Esporta istanza singleton
export const fantacalcioStatsApi = new FantacalcioStatsApi();
export default fantacalcioStatsApi;
