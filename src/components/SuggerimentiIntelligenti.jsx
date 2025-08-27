// Suggerimenti intelligenti che analizzano ruoli mancanti e giocatori preferiti
import React, { useMemo } from 'react';
import { Target, TrendingUp, DollarSign, AlertTriangle, Star, Zap } from 'lucide-react';

const SuggerimentiIntelligenti = ({
  preferiti,
  rosaNecessaria,
  conteggioRosa,
  rosa,
  budget,
  noteGiocatori,
  prezziPagati,
  getPrezzoSuggerito,
  calcolaPercentuale,
  onFocusGiocatore,
  RUOLI_MANTRA
}) => {
  // Analisi intelligente con preferiti
  const analisiIntelligente = useMemo(() => {
    const giocatoriRosa = rosa.length;
    const budgetRimanente = budget;
    const giocatoriMancanti = Math.max(0, 32 - giocatoriRosa);
    const budgetMedioPerGiocatore = giocatoriMancanti > 0 ? Math.floor(budgetRimanente / giocatoriMancanti) : 0;

    // 1. Trova ruoli criticamente mancanti
    const ruoliMancanti = [];
    Object.entries(rosaNecessaria.ruoli).forEach(([ruolo, necessari]) => {
      const attuali = conteggioRosa.ruoli[ruolo] || 0;
      if (attuali < necessari) {
        const mancanti = necessari - attuali;
        ruoliMancanti.push({
          ruolo,
          mancanti,
          necessari,
          attuali,
          urgenza: mancanti / necessari, // Percentuale di mancanza
          ruoloInfo: RUOLI_MANTRA[ruolo]
        });
      }
    });

    // Ordina per urgenza (ruoli con più mancanze percentuali)
    ruoliMancanti.sort((a, b) => b.urgenza - a.urgenza);

    // 2. Filtra preferiti per ruoli mancanti
    const preferitiUtili = preferiti.filter(giocatore => {
      // Esclude giocatori già in rosa
      if (rosa.some(r => r.id === giocatore.id)) return false;
      
      // Include solo se il suo ruolo è necessario
      return ruoliMancanti.some(rm => 
        rm.ruolo === giocatore.ruolo || 
        (giocatore.ruoloCompleto && giocatore.ruoloCompleto.includes(rm.ruolo))
      );
    });

    // 3. Calcola priorità per ogni preferito utile
    const preferitiConPriorita = preferitiUtili.map(giocatore => {
      const ruoloMatch = ruoliMancanti.find(rm => 
        rm.ruolo === giocatore.ruolo || 
        (giocatore.ruoloCompleto && giocatore.ruoloCompleto.includes(rm.ruolo))
      );

      const nota = noteGiocatori[`${giocatore.nome}_${giocatore.squadra}`] || '';
      const hasNota = nota.trim().length > 0;
      const prezzoSuggerito = getPrezzoSuggerito ? getPrezzoSuggerito(giocatore) : (giocatore.prezzoSuggerito || giocatore.FVM || 10);
      
      // Score priorità
      let priorityScore = 0;
      
      // Bonus per urgenza ruolo (0-100)
      if (ruoloMatch) {
        priorityScore += ruoloMatch.urgenza * 100;
      }
      
      // Bonus per note (indica interesse specifico) (+50)
      if (hasNota) {
        priorityScore += 50;
      }
      
      // Bonus per rapporto qualità/prezzo (+0-30)
      const fvm = giocatore.FVM || 0;
      if (fvm > 0 && prezzoSuggerito > 0) {
        const rapportoQP = Math.min(30, (fvm / prezzoSuggerito) * 5);
        priorityScore += rapportoQP;
      }
      
      // Bonus per FVM alto (+0-20)
      priorityScore += Math.min(20, (fvm || 0) / 5);

      return {
        ...giocatore,
        priorityScore,
        ruoloMatch,
        hasNota,
        nota,
        prezzoSuggerito,
        budgetFit: prezzoSuggerito <= budgetMedioPerGiocatore * 1.5 // Può spendere fino a 1.5x il budget medio
      };
    });

    // Ordina per priorità
    preferitiConPriorita.sort((a, b) => b.priorityScore - a.priorityScore);

    // 4. Crea suggerimenti specifici
    const suggerimenti = [];

    // Suggerimento TOP: Miglior preferito per ruolo più urgente
    if (preferitiConPriorita.length > 0) {
      const top = preferitiConPriorita[0];
      const urgenza = top.ruoloMatch?.urgenza > 0.7 ? '🚨 CRITICO' : 
                     top.ruoloMatch?.urgenza > 0.4 ? '⚠️ URGENTE' : '💡 CONSIGLIATO';
      
      suggerimenti.push({
        tipo: 'top_preferito',
        giocatore: top,
        urgenza,
        messaggio: `${urgenza}: ${top.nome} (${top.ruoloMatch?.ruoloInfo?.sigla}) ${top.hasNota ? '📝' : ''}`,
        budgetConsiglio: Math.min(top.prezzoSuggerito, budgetMedioPerGiocatore * 1.2),
        priorita: 'alta'
      });
    }

    // Suggerimenti per categoria ruolo
    const ruoliTop3 = ruoliMancanti.slice(0, 3);
    ruoliTop3.forEach(ruoloMancante => {
      const preferitiPerRuolo = preferitiConPriorita.filter(p => 
        p.ruoloMatch?.ruolo === ruoloMancante.ruolo
      ).slice(0, 2);

      if (preferitiPerRuolo.length > 0) {
        const nomi = preferitiPerRuolo.map(p => p.nome).join(', ');
        const budgetTotale = preferitiPerRuolo.reduce((sum, p) => sum + p.prezzoSuggerito, 0);
        
        suggerimenti.push({
          tipo: 'ruolo_preferiti',
          ruolo: ruoloMancante,
          giocatori: preferitiPerRuolo,
          messaggio: `${ruoloMancante.ruoloInfo?.sigla}: ${nomi} (${ruoloMancante.mancanti} needed)`,
          budgetConsiglio: budgetTotale,
          priorita: ruoloMancante.urgenza > 0.6 ? 'alta' : 'media'
        });
      }
    });

    // Suggerimenti budget
    if (preferitiUtili.length > 0) {
      const costoPreferiti = preferitiConPriorita.slice(0, Math.min(5, giocatoriMancanti))
        .reduce((sum, p) => sum + p.prezzoSuggerito, 0);
      
      if (costoPreferiti > budgetRimanente * 0.8) {
        suggerimenti.push({
          tipo: 'budget_warning',
          messaggio: `💰 Budget tight: i tuoi top 5 preferiti costano ${costoPreferiti}, hai ${budgetRimanente}`,
          priorita: 'alta'
        });
      }
    }

    return {
      ruoliMancanti,
      preferitiUtili: preferitiConPriorita.slice(0, 10),
      suggerimenti: suggerimenti.slice(0, 4),
      budgetMedioPerGiocatore,
      giocatoriMancanti
    };
  }, [preferiti, rosaNecessaria, conteggioRosa, rosa, budget, noteGiocatori, prezziPagati, RUOLI_MANTRA]);

  if (analisiIntelligente.suggerimenti.length === 0 && analisiIntelligente.preferitiUtili.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        <Target className="w-6 h-6 mx-auto mb-2 opacity-50" />
        <p className="text-xs">Nessun preferito utile per ruoli mancanti</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header con stats */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Target size={20} className="text-blue-600" />
            <span className="font-bold text-blue-900 text-lg">Target Asta</span>
          </div>
          <span className="text-sm text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
            {analisiIntelligente.preferitiUtili.length} preferiti utili
          </span>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="font-bold text-blue-900 text-xl">{analisiIntelligente.giocatoriMancanti}</div>
            <div className="text-blue-600 text-sm">da comprare</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="font-bold text-green-900 text-xl">{analisiIntelligente.budgetMedioPerGiocatore} FM</div>
            <div className="text-green-600 text-sm">budget medio</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="font-bold text-orange-900 text-xl">{analisiIntelligente.ruoliMancanti.length}</div>
            <div className="text-orange-600 text-sm">ruoli mancanti</div>
          </div>
        </div>
      </div>

      {/* Suggerimenti principali */}
      <div className="space-y-4">
        {analisiIntelligente.suggerimenti.map((sug, index) => (
          <div
            key={index}
            className={`rounded-lg p-4 border-l-4 cursor-pointer transition-all hover:shadow-lg shadow-sm ${
              sug.priorita === 'alta' 
                ? 'bg-red-50 border-red-400 hover:bg-red-100' 
                : 'bg-yellow-50 border-yellow-400 hover:bg-yellow-100'
            }`}
            onClick={() => {
              if (sug.giocatore) {
                onFocusGiocatore?.(sug.giocatore);
              } else if (sug.giocatori?.length > 0) {
                onFocusGiocatore?.(sug.giocatori[0]);
              }
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-base font-semibold text-gray-900 mb-2">
                  {sug.messaggio}
                </p>
                
                {sug.budgetConsiglio && (
                  <div className="flex items-center space-x-3 text-sm text-gray-700 mb-2">
                    <DollarSign size={16} />
                    <span className="font-medium">
                      Budget suggerito: {sug.budgetConsiglio} FM ({calcolaPercentuale ? calcolaPercentuale(sug.budgetConsiglio) : "0.0"}%)
                    </span>
                    {budget >= sug.budgetConsiglio ? (
                      <span className="text-green-600 font-bold">✓ OK</span>
                    ) : (
                      <span className="text-red-600 font-bold">⚠ Oltre budget</span>
                    )}
                  </div>
                )}
                
                {sug.giocatore?.nota && (
                  <div className="mt-2 text-sm text-blue-800 bg-blue-100 rounded-lg px-3 py-2 border border-blue-200">
                    <div className="flex items-start space-x-2">
                      <span>📝</span>
                      <span className="font-medium">{sug.giocatore.nota}</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2 ml-3">
                {sug.priorita === 'alta' && <AlertTriangle size={20} className="text-red-500" />}
                {sug.giocatore?.hasNota && <Star size={16} className="text-yellow-500" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lista preferiti prioritari */}
      {analisiIntelligente.preferitiUtili.length > 0 && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
          <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
            <Zap size={18} className="mr-2 text-yellow-500" />
            Top Preferiti Utili
          </h4>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {analisiIntelligente.preferitiUtili.slice(0, 6).map((giocatore, index) => (
              <div
                key={`${giocatore.nome}_${giocatore.squadra}`}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:bg-blue-50 cursor-pointer transition-all hover:shadow-md"
                onClick={() => onFocusGiocatore?.(giocatore)}
              >
                <div className="flex items-center space-x-3 flex-1">
                  <span className="text-sm font-bold text-gray-600 bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center">#{index + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-semibold text-base text-gray-900">{giocatore.nome}</span>
                      <span className={`px-2 py-1 text-xs rounded font-bold text-white ${giocatore.ruoloMatch?.ruoloInfo?.colore || 'bg-gray-500'}`}>
                        {giocatore.ruoloMatch?.ruoloInfo?.sigla}
                      </span>
                      {giocatore.hasNota && <Star size={14} className="text-yellow-500" />}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{giocatore.squadra}</span> • 
                      <span className="ml-1">FVM: {giocatore.FVM || 'N/A'}</span> • 
                      <span className={`ml-1 font-medium ${
                        giocatore.ruoloMatch?.urgenza > 0.7 ? 'text-red-600' : 
                        giocatore.ruoloMatch?.urgenza > 0.4 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        Urgenza: {Math.round(giocatore.ruoloMatch?.urgenza * 100 || 0)}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-lg font-bold ${giocatore.budgetFit ? 'text-green-600' : 'text-red-600'}`}>
                    {giocatore.prezzoSuggerito} FM
                  </div>
                  <div className="text-sm text-gray-500">
                    ({calcolaPercentuale ? calcolaPercentuale(giocatore.prezzoSuggerito) : "0.0"}% budget)
                  </div>
                  <div className="text-xs text-gray-400">
                    Score: {Math.round(giocatore.priorityScore)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SuggerimentiIntelligenti;
