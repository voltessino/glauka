'use strict';
// Country/territory code coverage, not stereotypes or evidence of real nationalities.
// ISO 3166-1 alpha-2, snapshot 2026-10-27 (249 country/territory codes).
const COUNTRY_CODES='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const SUBJECTS=[
 'Anatomia umana','Istologia','Fisiologia','Farmacologia','Infermieristica','Chirurgia',
 'Epidemiologia','Biochimica','Microbiologia','Genetica','Neuroscienze','Ingegneria biomedica',
 'Matematica','Algebra','Analisi','Geometria','Fisica','Termodinamica','Chimica','Chimica organica',
 'Biologia','Ecologia','Astronomia','Geologia','Geografia','Meteorologia',
 'Informatica','Algoritmi','Data science','Machine learning','Cybersecurity','Reti informatiche',
 'Elettronica','Robotica','Ingegneria civile','Statistica','Economia','Contabilità',
 'Finanza aziendale','Marketing','Diritto','Diritto internazionale','Storia antica','Storia moderna',
 'Storia contemporanea','Filosofia','Logica','Psicologia','Pedagogia','Sociologia',
 'Antropologia','Linguistica','Letteratura','Grammatica','Traduzione','Storia dell’arte',
 'Architettura','Disegno tecnico','Musica','Cinema','Etica','Scienze politiche',
 'Agronomia','Veterinaria','Scienze motorie','Scienza dei materiali','Project management',
 'Formazione professionale','Educazione primaria','Gestione sanitaria','Economia ambientale',
 'Archeologia','Demografia','Criminologia','Urbanistica','Oceanografia','Relazioni internazionali',
 'Teoria dei giochi','Energia rinnovabile','Fotografia','Nutrizione'
];
const SCRIPTS=[
 'α β μ Ω · formule', '中文 汉字 · esempio', 'العربية والطب · مثال',
 'हिंदी और विज्ञान · उदाहरण', 'ภาษาไทย · บทเรียน', 'Русский текст · схема',
 'עברית · מושגים', '한국어 · 개념', '日本語 · 心臓', 'Español · circulación',
 'Français · résumé', 'Português · revisão', 'Deutsch · Übung',
 'Türkçe · çalışma', 'Tiếng Việt · ghi chú', 'Ελληνικά · μάθημα',
 'Italiano · appendice', 'Kiswahili · somo', 'اردو · مثال', 'Bahasa Indonesia · pelajaran'
];
const WORKFLOWS=[
 'image-node','image-free','image-two','image-editor','text-and-image',
 'quiz-exam','map-outline','workspace-reload','pdf-source','view-undo'
];
function student(i){
 if(!Number.isInteger(i)||i<0||i>=1000)throw Error('Student index outside 0..999');
 return Object.freeze({
  id:'S'+String(i+1).padStart(4,'0'),
  countryCode:COUNTRY_CODES[i%COUNTRY_CODES.length],
  subject:SUBJECTS[(i*17+Math.floor(i/COUNTRY_CODES.length))%SUBJECTS.length],
  specimen:SCRIPTS[(i*7+Math.floor(i/20))%SCRIPTS.length],
  workflow:WORKFLOWS[i%WORKFLOWS.length],
  minutes:[10,20,35,45,75,120][i%6],
  device:[0,1,2,7].includes(i%10)?'android':'desktop',
  language:i%2?'en':'it',
  seed:i+1
 });
}
const STUDENTS=Object.freeze(Array.from({length:1000},(_,i)=>student(i)));
function treeFor(s,n=8){
 return {text:s.subject+' · '+s.id,notes:'Contesto '+s.countryCode+' — '+s.specimen,
  children:Array.from({length:n},(_,j)=>({text:s.subject+' · capitolo '+(j+1),
   notes:s.specimen+' | '+j,children:[{text:'Esempio '+j,notes:'Revisione '+s.specimen,children:[]}]}))};
}
module.exports=Object.freeze({COUNTRY_CODES,SUBJECTS,SCRIPTS,WORKFLOWS,STUDENTS,student,treeFor});
