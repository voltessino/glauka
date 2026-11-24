/* Illustrative content for captures of the real app, with no personal documents. */
"use strict";
module.exports = () => ({
  text: "Il mio progetto",
  children: [
    ["L’idea", "Una domanda", "Il risultato"],
    ["Le persone", "A chi serve", "Con chi farlo"],
    ["Le risorse", "Appunti", "Riferimenti"],
    ["Il piano", "Le priorità", "Un passo concreto"],
    ["La prova", "Cosa funziona", "Cosa migliorare"],
    ["Il lancio", "Condividere", "Raccogliere risposte"],
  ].map(([text, ...labels]) => ({
    text,
    children: labels.map((text) => ({ text, children: [] })),
  })),
});
