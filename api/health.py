from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def handler(request):
    """Health check per Vercel"""
    return jsonify({
        "status": "ok",
        "service": "Fantacalcio Stats API", 
        "version": "2.0",
        "platform": "Vercel Serverless",
        "message": "✅ Backend attivo e funzionante"
    })
