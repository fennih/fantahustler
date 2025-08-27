// Componente Modal per visualizzare statistiche giocatore
import React from 'react';
import { X } from 'lucide-react';

const PlayerStatsModal = ({ isOpen, onClose, giocatore }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {giocatore?.nome || 'Statistiche Giocatore'}
              </h2>
              <p className="text-sm text-gray-600">
                {giocatore?.squadra} • {giocatore?.ruolo}
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

        {/* Content */}
        <div className="p-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Statistiche Giocatore
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Le statistiche dettagliate del giocatore saranno disponibili in una versione futura.
            </p>
            
            {/* Basic player info */}
            <div className="bg-gray-50 rounded-lg p-6 max-w-md mx-auto">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Nome:</span>
                  <span className="font-semibold">{giocatore?.nome}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Squadra:</span>
                  <span className="font-semibold">{giocatore?.squadra}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Ruolo:</span>
                  <span className="font-semibold">{giocatore?.ruolo}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">FVM:</span>
                  <span className="font-semibold">{giocatore?.FVM}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerStatsModal;
