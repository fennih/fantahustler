#!/usr/bin/env python3
"""
Oracle Cloud VM App - Backend FBref per Fantacalcio
Deploy su Oracle Cloud con dati reali SoccerData
"""

import os
import sys
import time
import logging
from pathlib import Path
from flask import Flask, request, jsonify
# from flask_cors import CORS  # Rimosso: Nginx gestisce CORS
from fuzzywuzzy import fuzz
import pandas as pd

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OracleFBrefService:
    """Servizio FBref per Oracle Cloud con dati reali"""
    
    def _safe_numeric(self, value, default=0):
        """Converte un valore in numero, gestendo NaN e valori non validi"""
        try:
            numeric_value = pd.to_numeric(value, errors='coerce')
            if pd.isna(numeric_value) or numeric_value == float('inf') or numeric_value == float('-inf'):
                return default
            return numeric_value
        except:
            return default
    
    def _safe_round(self, value, decimals=1, default=0):
        """Arrotonda un valore gestendo NaN e infiniti"""
        try:
            numeric_value = pd.to_numeric(value, errors='coerce')
            if pd.isna(numeric_value) or numeric_value == float('inf') or numeric_value == float('-inf'):
                return default
            return round(float(numeric_value), decimals)
        except:
            return default
    
    def __init__(self):
        """Inizializza il servizio con SoccerData reale"""
        self.soccerdata_available = False
        self.fbref = None
        self.cache = {}
        self.cache_timeout = 30 * 60  # 30 minuti
        
        try:
            # Importa soccerdata
            import soccerdata as sd
            
            logger.info("🔄 Inizializzazione FBref Oracle Cloud...")
            
            # Inizializza FBref per Serie A - ultime 3 stagioni
            self.fbref = sd.FBref(
                leagues=['ITA-Serie A'], 
                seasons=['2425']  # Solo 2024-25 per Oracle
            )
            
            self.soccerdata_available = True
            logger.info("✅ SoccerData inizializzato su Oracle Cloud")
            
            # Pre-carica dati base
            self._preload_data()
            
        except Exception as e:
            logger.error(f"❌ Errore inizializzazione SoccerData su Oracle: {e}")
            self.soccerdata_available = False
    
    def _preload_data(self):
        """Pre-carica i dati principali per performance"""
        try:
            logger.info("📥 Pre-caricamento dati Serie A Oracle...")
            
            # Carica statistiche standard
            self.standard_stats = self.fbref.read_player_season_stats(stat_type='standard')
            logger.info(f"✅ Standard stats: {len(self.standard_stats)} giocatori")
            
            # Carica statistiche passaggi
            self.passing_stats = self.fbref.read_player_season_stats(stat_type='passing')
            logger.info(f"✅ Passing stats: {len(self.passing_stats)} giocatori")
            
            # Carica statistiche tiro
            self.shooting_stats = self.fbref.read_player_season_stats(stat_type='shooting')
            logger.info(f"✅ Shooting stats: {len(self.shooting_stats)} giocatori")
            
            # Carica statistiche portieri
            self.keeper_stats = self.fbref.read_player_season_stats(stat_type='keeper')
            logger.info(f"✅ Keeper stats: {len(self.keeper_stats)} portieri")
            
            logger.info("🎯 Dati FBref completamente caricati su Oracle!")
            
        except Exception as e:
            logger.error(f"❌ Errore preload Oracle: {e}")
    
    def _normalize_player_name(self, player_name):
        """Normalizza i nomi dei giocatori per il matching"""
        name_lower = player_name.lower().strip()
        
        # Mappature specifiche per abbreviazioni comuni
        name_mappings = {
            "martinez l.": "lautaro martinez",
            "martinez l": "lautaro martinez", 
            "lautaro m.": "lautaro martinez",
            "thuram m.": "marcus thuram",
            "thuram": "marcus thuram",
            "vlahovic d.": "dusan vlahovic",
            "vlahovic": "dusan vlahovic",
            "osimhen v.": "victor osimhen",
            "osimhen": "victor osimhen",
            "yildiz": "kenan yildiz",
            "yildiz k.": "kenan yildiz",
            "kenan y.": "kenan yildiz",
            "chiesa": "federico chiesa",
            "chiesa f.": "federico chiesa",
            "kvaratskhelia": "khvicha kvaratskhelia",
            "kvara": "khvicha kvaratskhelia"
        }
        
        if name_lower in name_mappings:
            logger.info(f"🔄 Mappatura: '{name_lower}' -> '{name_mappings[name_lower]}'")
            return name_mappings[name_lower]
        
        return name_lower
    
    def _find_player(self, player_name, team_name=None):
        """Trova un giocatore usando fuzzy matching"""
        normalized_input = self._normalize_player_name(player_name)
        logger.info(f"🔍 Ricerca Oracle {player_name} -> {normalized_input}")
        
        all_players = self.standard_stats.index.get_level_values('player').unique()
        best_match = None
        best_score = 0
        
        for player in all_players:
            score = fuzz.ratio(normalized_input, player.lower())
            
            # Bonus per match parziali
            if normalized_input in player.lower() or player.lower() in normalized_input:
                score += 30
            
            # Bonus per match di parole chiave
            normalized_words = normalized_input.split()
            player_words = player.lower().split()
            
            for norm_word in normalized_words:
                for player_word in player_words:
                    if len(norm_word) > 2 and len(player_word) > 2:
                        if norm_word in player_word or player_word in norm_word:
                            score += 20
            
            # Bonus per team se specificato
            if team_name and score > 60:
                player_data = self.standard_stats[
                    self.standard_stats.index.get_level_values('player') == player
                ]
                player_teams = player_data.index.get_level_values('team').unique()
                for team in player_teams:
                    if team_name.lower() in team.lower():
                        score += 40
                        break
            
            if score > best_score and score > 80:
                best_score = score
                best_match = player
        
        if best_match:
            logger.info(f"🎯 Trovato: {best_match} (score: {best_score})")
            return best_match
        
        logger.warning(f"❌ Nessun match per '{player_name}'")
        return None
    
    def get_player_stats(self, player_name, team_name=None):
        """Recupera statistiche reali del giocatore"""
        if not self.soccerdata_available:
            return {
                "error": "SoccerData non disponibile su Oracle Cloud",
                "message": "Servizio non inizializzato correttamente"
            }
        
        try:
            # Controlla cache
            cache_key = f"{player_name}_{team_name or 'no_team'}"
            if cache_key in self.cache:
                cached_data, cached_time = self.cache[cache_key]
                if time.time() - cached_time < self.cache_timeout:
                    logger.info(f"📦 Cache hit per {player_name}")
                    return cached_data
            
            logger.info(f"🔍 Ricerca Oracle {player_name} ({team_name or 'auto'})")
            
            # Trova il giocatore
            matched_player = self._find_player(player_name, team_name)
            if not matched_player:
                return {
                    "error": f"Giocatore '{player_name}' non trovato",
                    "available_players": []
                }
            
            # Ottieni dati stagione corrente
            current_season_data = self.standard_stats[
                self.standard_stats.index.get_level_values('player') == matched_player
            ].iloc[0]
            
            current_index = self.standard_stats[
                self.standard_stats.index.get_level_values('player') == matched_player
            ].index[0]
            
            league, season, team, full_name = current_index
            
            # Costruisci risposta base
            result = {
                "player": {
                    "name": full_name,
                    "team": team,
                    "league": league,
                    "season": "2024-25"
                },
                "stats": {
                    "generale": {
                        "partite_giocate": int(self._safe_numeric(current_season_data.get(('Playing Time', 'MP'), 0))),
                        "minuti_totali": int(self._safe_numeric(current_season_data.get(('Playing Time', 'Min'), 0))),
                        "gol": int(self._safe_numeric(current_season_data.get(('Performance', 'Gls'), 0))),
                        "assist": int(self._safe_numeric(current_season_data.get(('Performance', 'Ast'), 0))),
                        "cartellini_gialli": int(self._safe_numeric(current_season_data.get(('Performance', 'CrdY'), 0))),
                        "cartellini_rossi": int(self._safe_numeric(current_season_data.get(('Performance', 'CrdR'), 0)))
                    },
                    "passaggi": {},
                    "portiere": {}
                },
                "fantacalcio_insights": {
                    "voto_medio_stimato": round(6.0 + (int(self._safe_numeric(current_season_data.get(('Performance', 'Gls'), 0))) + int(self._safe_numeric(current_season_data.get(('Performance', 'Ast'), 0)))) * 0.1, 1),
                    "bonus_malus_attesi": round((int(self._safe_numeric(current_season_data.get(('Performance', 'Gls'), 0))) * 3 + int(self._safe_numeric(current_season_data.get(('Performance', 'Ast'), 0))) - int(self._safe_numeric(current_season_data.get(('Performance', 'CrdY'), 0))) * 0.5), 1),
                    "affidabilita": "Alta" if int(self._safe_numeric(current_season_data.get(('Playing Time', 'MP'), 0))) > 15 else "Media",
                    "trend": "Stabile",
                    "consigli": [
                        f"Ha giocato {int(self._safe_numeric(current_season_data.get(('Playing Time', 'MP'), 0)))} partite",
                        f"Contributo gol+assist: {int(self._safe_numeric(current_season_data.get(('Performance', 'Gls'), 0))) + int(self._safe_numeric(current_season_data.get(('Performance', 'Ast'), 0)))}",
                        "Dati reali FBref via Oracle Cloud"
                    ]
                },
                "fonte": "FBref via SoccerData (Oracle Cloud)",
                "ultimo_aggiornamento": "2024-12-28"
            }
            
            # Aggiungi statistiche passaggi se disponibili
            try:
                passing_data = self.passing_stats[
                    self.passing_stats.index.get_level_values('player') == matched_player
                ].iloc[0]
                
                result["stats"]["passaggi"] = {
                    "passaggi_totali": int(self._safe_numeric(passing_data.get(('Total', 'Att'), 0))),
                    "precisione_passaggi": self._safe_round(passing_data.get(('Total', 'Cmp%'), 0), 1)
                }
            except:
                pass
            
            # Verifica se è un portiere e aggiungi stats
            try:
                keeper_data = self.keeper_stats[
                    self.keeper_stats.index.get_level_values('player') == matched_player
                ]
                
                if not keeper_data.empty:
                    keeper_current = keeper_data.iloc[0]
                    clean_sheets = int(self._safe_numeric(keeper_current.get(('Performance', 'CS'), 0)))
                    gol_subiti = int(self._safe_numeric(keeper_current.get(('Performance', 'GA'), 0)))
                    
                    result["stats"]["portiere"] = {
                        "partite_giocate": int(self._safe_numeric(keeper_current.get(('Playing Time', 'MP'), 0))),
                        "gol_subiti": gol_subiti,
                        "parate": int(self._safe_numeric(keeper_current.get(('Performance', 'Saves'), 0))),
                        "percentuale_parate": self._safe_round(keeper_current.get(('Performance', 'Save%'), 0), 1),
                        "clean_sheets": clean_sheets,
                        "percentuale_clean_sheets": self._safe_round(keeper_current.get(('Performance', 'CS%'), 0), 1)
                    }
                    
                    # Aggiorna insights per portiere
                    result["fantacalcio_insights"].update({
                        "voto_medio_stimato": round(6.0 + clean_sheets * 0.1 - gol_subiti * 0.05, 1),
                        "bonus_malus_attesi": round(clean_sheets - gol_subiti, 1),
                        "ruolo": "Portiere",
                        "consigli": [
                            f"Portiere con {clean_sheets} clean sheets",
                            f"Parate: {result['stats']['portiere']['parate']}",
                            "Dati reali FBref via Oracle Cloud"
                        ]
                    })
            except:
                pass
            
            # Salva in cache
            self.cache[cache_key] = (result, time.time())
            
            logger.info(f"✅ Stats Oracle recuperate per {full_name}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Errore recupero stats Oracle: {e}")
            return {"error": f"Errore interno Oracle: {str(e)}"}

# Inizializza servizio
logger.info("🚀 Inizializzazione Oracle Cloud FBref Service...")
fbref_service = OracleFBrefService()

# Inizializza Flask
app = Flask(__name__)
# CORS rimosso - gestito da Nginx per evitare header duplicati
# CORS(app, origins=[
#     'http://localhost:3000', 
#     'https://fantahustler.vercel.app',
#     'https://fantahustler-*.vercel.app'
# ])

@app.route('/api/player-stats/<player_name>', methods=['GET'])
def get_player_stats(player_name):
    """Endpoint per statistiche giocatore"""
    try:
        team_name = request.args.get('team')
        logger.info(f"🎯 Oracle API Request: {player_name} ({team_name or 'no team'})")
        
        stats = fbref_service.get_player_stats(player_name, team_name)
        
        # Aggiungi header per identificare la fonte
        response = jsonify(stats)
        response.headers['X-Data-Source'] = 'Oracle-FBref-Real'
        return response
        
    except Exception as e:
        logger.error(f"❌ Errore Oracle API: {e}")
        return jsonify({"error": f"Errore Oracle: {str(e)}"}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check per Oracle Cloud"""
    return jsonify({
        "status": "ok",
        "platform": "Oracle Cloud",
        "soccerdata_available": fbref_service.soccerdata_available,
        "service": "Real FBref Service - Oracle Cloud Deploy",
        "cached_players": len(fbref_service.cache) if hasattr(fbref_service, 'cache') else 0,
        "data_loaded": {
            "standard_stats": len(fbref_service.standard_stats) if hasattr(fbref_service, 'standard_stats') and not fbref_service.standard_stats.empty else 0,
            "passing_stats": len(fbref_service.passing_stats) if hasattr(fbref_service, 'passing_stats') and not fbref_service.passing_stats.empty else 0,
            "shooting_stats": len(fbref_service.shooting_stats) if hasattr(fbref_service, 'shooting_stats') and not fbref_service.shooting_stats.empty else 0,
            "keeper_stats": len(fbref_service.keeper_stats) if hasattr(fbref_service, 'keeper_stats') and not fbref_service.keeper_stats.empty else 0
        }
    })

@app.route('/api/cache/clear', methods=['POST'])
def clear_cache():
    """Pulisce la cache"""
    if hasattr(fbref_service, 'cache'):
        fbref_service.cache.clear()
        return jsonify({"message": "Cache Oracle pulita", "status": "ok"})
    return jsonify({"message": "Cache non disponibile", "status": "error"})

@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({
        "message": "Fantacalcio Stats API - Oracle Cloud Backend",
        "status": "running",
        "endpoints": [
            "GET /api/player-stats/<nome>?team=<squadra>",
            "GET /api/health",
            "POST /api/cache/clear"
        ],
        "data_source": "FBref via SoccerData",
        "platform": "Oracle Cloud"
    })

if __name__ == '__main__':
    # Oracle Cloud - porta fissa per Nginx proxy
    port = 5003
    
    print("🚀 Fantacalcio Backend - Oracle Cloud Deploy")
    print("📊 Serie A 2024-25 (Dati REALI FBref)")
    print(f"🌐 Port: {port}")
    print("📋 Endpoints:")
    print("   GET /api/player-stats/<nome>?team=<squadra>")
    print("   GET /api/health")
    print("   POST /api/cache/clear")
    print()
    
    if fbref_service.soccerdata_available:
        print("✅ SoccerData pronto su Oracle Cloud!")
        print("⚠️  PRIMA VOLTA: download dati può richiedere 2-3 minuti")
    else:
        print("❌ SoccerData non disponibile")
    
    print("💡 Oracle Cloud - Always On, 24GB RAM")
    print()
    
    # Oracle Cloud - porta fissa 5003 per Nginx
    app.run(host='0.0.0.0', port=port, debug=False)
