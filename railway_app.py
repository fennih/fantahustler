#!/usr/bin/env python3
"""
Railway App - Backend FBref per Fantacalcio
Deploy su Railway con dati reali SoccerData
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging

# Import del servizio reale
from backend.real_fbref_service import RealFBrefService

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inizializza Flask
app = Flask(__name__)

# CORS per permettere chiamate dal frontend Vercel
CORS(app, origins=[
    "https://fantahustler-8f1tqavmv-fennihs-projects.vercel.app",
    "https://*.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173"
])

# Inizializza servizio FBref
logger.info("🚀 Inizializzazione Railway FBref Service...")
fbref_service = RealFBrefService()

@app.route('/api/player-stats/<player_name>', methods=['GET'])
def get_player_stats(player_name):
    """Endpoint per statistiche giocatore"""
    try:
        team_name = request.args.get('team')
        logger.info(f"🎯 Railway API Request: {player_name} ({team_name or 'no team'})")
        
        stats = fbref_service.get_player_stats(player_name, team_name)
        
        # Aggiungi header per identificare la fonte
        response = jsonify(stats)
        response.headers['X-Data-Source'] = 'Railway-FBref-Real'
        return response
        
    except Exception as e:
        logger.error(f"❌ Errore Railway API: {e}")
        return jsonify({"error": f"Errore Railway: {str(e)}"}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check per Railway"""
    return jsonify({
        "status": "ok",
        "platform": "Railway",
        "soccerdata_available": fbref_service.soccerdata_available,
        "service": "Real FBref Service - Railway Deploy",
        "cached_players": len(fbref_service.cache) if hasattr(fbref_service, 'cache') else 0,
        "data_loaded": {
            "standard_stats": len(fbref_service.standard_stats) if hasattr(fbref_service, 'standard_stats') and not fbref_service.standard_stats.empty else 0,
            "shooting_stats": len(fbref_service.shooting_stats) if hasattr(fbref_service, 'shooting_stats') and not fbref_service.shooting_stats.empty else 0,
            "passing_stats": len(fbref_service.passing_stats) if hasattr(fbref_service, 'passing_stats') and not fbref_service.passing_stats.empty else 0,
            "defense_stats": len(fbref_service.defense_stats) if hasattr(fbref_service, 'defense_stats') and not fbref_service.defense_stats.empty else 0,
            "possession_stats": len(fbref_service.possession_stats) if hasattr(fbref_service, 'possession_stats') and not fbref_service.possession_stats.empty else 0,
            "keeper_stats": len(fbref_service.keeper_stats) if hasattr(fbref_service, 'keeper_stats') and not fbref_service.keeper_stats.empty else 0
        }
    })

@app.route('/api/cache/clear', methods=['POST'])
def clear_cache():
    """Pulisce la cache"""
    if hasattr(fbref_service, 'cache'):
        fbref_service.cache.clear()
        return jsonify({"message": "Cache Railway pulita", "status": "ok"})
    return jsonify({"message": "Cache non disponibile", "status": "error"})

@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({
        "message": "Fantacalcio Stats API - Railway Backend",
        "status": "running",
        "endpoints": [
            "GET /api/player-stats/<nome>?team=<squadra>",
            "GET /api/health",
            "POST /api/cache/clear"
        ],
        "data_source": "FBref via SoccerData",
        "platform": "Railway"
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    
    print("🚀 Fantacalcio Backend - Railway Deploy")
    print("📊 Serie A 2024-25 (Dati REALI FBref)")
    print(f"🌐 Port: {port}")
    print("📋 Endpoints:")
    print("   GET /api/player-stats/<nome>?team=<squadra>")
    print("   GET /api/health")
    print("   POST /api/cache/clear")
    print()
    
    if fbref_service.soccerdata_available:
        print("✅ SoccerData pronto su Railway!")
        print("⚠️  PRIMA VOLTA: download dati può richiedere 2-3 minuti")
    else:
        print("❌ SoccerData non disponibile")
    
    print("💡 Railway gestisce restart automatico")
    print()
    
    # Railway usa PORT environment variable
    app.run(host='0.0.0.0', port=port, debug=False)
