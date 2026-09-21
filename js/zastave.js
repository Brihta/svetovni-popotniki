/* =====================================================================
   Svetovni popotniki — kviz zastav
   Potek ure: 6 zastav na zaslon → 2 minuti pisanja na tablice →
   razkrivanje ena po ena → klik na učence, ki so uganili → točke.

   Odvisnosti: js/oblak.js (shramba na GitHubu), js/drzave.js (200 držav)
   ===================================================================== */
'use strict';

const MEST = 6;
const KROGI_MEJA = 5000;   // ~800 ur pouka; starejše se odrežejo

const $  = (s, k = document) => k.querySelector(s);
const $$ = (s, k = document) => [...k.querySelectorAll(s)];

/* ------------------------------------------------------------------ *
 * SHRAMBA — samo delovna kopija. Pravi zapis je na GitHubu.
 * ------------------------------------------------------------------ */
const Shramba = {
  beri(kljuc, privzeto) {
    try {
      const v = localStorage.getItem('popotniki_' + kljuc);
      return v === null ? privzeto : JSON.parse(v);
    } catch (e) { return privzeto; }
  },
  pisi(kljuc, vrednost) {
    try { localStorage.setItem('popotniki_' + kljuc, JSON.stringify(vrednost)); return true; }
    catch (e) { obvesti('Shramba brskalnika je polna.'); return false; }
  },
};

/* ------------------------------------------------------------------ *
 * STANJE
 *
 * Edini zapis, ki šteje, so KROGI — po en na razkrito zastavo, z imeni
 * tistih, ki so jo uganili. Točke in „že videne zastave" sta izpeljanki.
 * To ni okrasje: vsak krog ima svoj id, zato se podatki z dveh učilnic
 * zlijejo brez konfliktov. Seštevkov se zliti ne da.
 * ------------------------------------------------------------------ */
const Stanje = {
  skupina: Shramba.beri('skupina', 'A'),
  mesta: null,                                   // [{ k, skrito }] × 6
  celina: Shramba.beri('celina', ''),
  brezPonavljanja: Shramba.beri('brezPonavljanja', true),
  sekund: Shramba.beri('sekund', 120),
  zvok: Shramba.beri('zvok', true),

  ucenci: Shramba.beri('ucenci', null),          // { A:{naziv,ucenci:[]}, B:{...} }
  krogi: Shramba.beri('krogi', []),              // [{ id, cas, spremenjeno, skupina, drzava, pravilni[] }]
  zacetekZastav: Shramba.beri('zacetekZastav', { A: null, B: null }),

  kviz: null,                                    // { id, razkrite:Set, aktivno:int|null }
};

Stanje.mesta = (() => {
  const shranjeno = Shramba.beri('mesta', null);
  if (Array.isArray(shranjeno) && shranjeno.length === MEST) return shranjeno;
  return Array.from({ length: MEST }, () => ({ k: null, skrito: true }));
})();

/** Nastavitve zaslona — te so res lokalne in ne gredo nikamor. */
function shraniStanje() {
  Shramba.pisi('skupina', Stanje.skupina);
  Shramba.pisi('mesta', Stanje.mesta);
  Shramba.pisi('celina', Stanje.celina);
  Shramba.pisi('brezPonavljanja', Stanje.brezPonavljanja);
  Shramba.pisi('sekund', Stanje.sekund);
  Shramba.pisi('zvok', Stanje.zvok);
}

/** Delovna kopija + naročilo za zapis na GitHub. */
function shraniPodatke() {
  Shramba.pisi('krogi', Stanje.krogi);
  Shramba.pisi('zacetekZastav', Stanje.zacetekZastav);
  // Tudi imena: brez tega bi seznam, naložen iz varnostne kopije, ob osvežitvi
  // strani izginil povsod, kjer ni ne GitHuba ne popotniki.json.
  if (Stanje.ucenci) Shramba.pisi('ucenci', Stanje.ucenci);
  Sinhro.naroci();
}

/* ---- izpeljanke iz krogov ---- */

/** { ime: točke } za skupino. Ena uganjena zastava = ena točka. */
function tockeZa(skupina) {
  const t = {};
  Stanje.krogi.forEach(k => {
    if (k.skupina !== skupina) return;
    k.pravilni.forEach(ime => { t[ime] = (t[ime] || 0) + 1; });
  });
  return t;
}

/**
 * Kode zastav, ki jih je skupina že videla.
 * „Pozabi zgodovino zastav" premakne začetek, točk pa ne briše —
 * zato tu filtriramo po datumu namesto da bi zapise izbrisali.
 */
function videneZa(skupina) {
  const od = Stanje.zacetekZastav[skupina];
  const v = new Set();
  Stanje.krogi.forEach(k => {
    if (k.skupina !== skupina) return;
    if (od && k.cas <= od) return;
    v.add(k.drzava);
  });
  return v;
}

/** Zlije dva seznama krogov. Isti id → obvelja novejša sprememba. */
function zlijKroge(a, b) {
  const m = new Map();
  [...(a || []), ...(b || [])].forEach(k => {
    if (!k || !k.id) return;
    const prej = m.get(k.id);
    const kdaj = x => x.spremenjeno || x.cas || '';
    if (!prej || kdaj(k) > kdaj(prej)) m.set(k.id, k);
  });
  const zlito = [...m.values()].sort((x, y) => (x.cas < y.cas ? -1 : x.cas > y.cas ? 1 : 0));
  return zlito.length > KROGI_MEJA ? zlito.slice(zlito.length - KROGI_MEJA) : zlito;
}

/* ------------------------------------------------------------------ *
 * SINHRONIZACIJA
 * Ura se nikoli ne ustavi zaradi omrežja: točkujemo naprej v brskalnik,
 * na GitHub pa pošljemo takoj, ko gre. Značka v glavi pove, kje smo.
 * ------------------------------------------------------------------ */
const Sinhro = {
  cakajoce: Shramba.beri('cakajoce', false),
  odmik: null,
  tece: false,
  zadnja: Shramba.beri('zadnjaSinhro', null),

  /** Sestavi dokument za zapis; `oddaljeni` je vsebina, ki je že na GitHubu. */
  dokument(oddaljeni) {
    return {
      razlicica: 2,
      posodobljeno: new Date().toISOString(),
      ucenci: Stanje.ucenci || (oddaljeni && oddaljeni.ucenci) || null,
      zacetekZastav: Stanje.zacetekZastav,
      krogi: oddaljeni ? zlijKroge(Stanje.krogi, oddaljeni.krogi) : Stanje.krogi,
    };
  },

  naroci() {
    this.cakajoce = true;
    Shramba.pisi('cakajoce', true);
    this.znacka();
    if (!Oblak.jePovezan()) return;
    clearTimeout(this.odmik);
    // počakamo, da učitelj neha klikati imena — en zapis na krog, ne na klik
    this.odmik = setTimeout(() => this.poslji(), 2500);
  },

  async poslji(rocno = false) {
    if (!Oblak.jePovezan()) { this.znacka(); return false; }
    if (this.tece) return false;
    this.tece = true;
    Oblak._javi('poteka');
    this.znacka();

    try {
      const zapisano = await Oblak.zapisi(
        odd => this.dokument(odd),
        'Točke: ' + new Date().toLocaleString('sl-SI')
      );
      // po morebitnem zlitju prevzamemo, kar je zdaj na GitHubu
      Stanje.krogi = zapisano.krogi;
      Shramba.pisi('krogi', Stanje.krogi);

      this.cakajoce = false;
      this.zadnja = new Date().toISOString();
      Shramba.pisi('cakajoce', false);
      Shramba.pisi('zadnjaSinhro', this.zadnja);
      Oblak._javi('usklajeno');
      if (rocno) obvesti('Točke so shranjene na GitHub.');
      return true;
    } catch (e) {
      Oblak._javi('napaka', e.message);
      if (rocno) obvesti(e.message);
      return false;
    } finally {
      this.tece = false;
      this.znacka();
      osveziPrikaze();
    }
  },

  /** Ob zagonu: kar je na GitHubu, zlijemo s tem, kar je ostalo lokalno. */
  async potegni() {
    if (!Oblak.jePovezan()) { this.znacka(); return false; }
    Oblak._javi('poteka');
    this.znacka();
    try {
      const { podatki } = await Oblak.prenesi();
      if (podatki) {
        Stanje.krogi = zlijKroge(Stanje.krogi, podatki.krogi);
        if (podatki.ucenci) Stanje.ucenci = podatki.ucenci;
        if (podatki.zacetekZastav) Stanje.zacetekZastav = podatki.zacetekZastav;
        Shramba.pisi('krogi', Stanje.krogi);
        Shramba.pisi('zacetekZastav', Stanje.zacetekZastav);
        if (Stanje.ucenci) Shramba.pisi('ucenci', Stanje.ucenci);
      }
      Oblak._javi(this.cakajoce ? 'caka' : 'usklajeno');
      // če smo med potjo kaj nabrali ali datoteke sploh še ni, jo zapišemo
      if (this.cakajoce || !podatki) await this.poslji();
      return true;
    } catch (e) {
      Oblak._javi('napaka', e.message);
      return false;
    } finally {
      this.znacka();
    }
  },

  /**
   * Če zapis ne uspe (omrežje pade sredi ure), ga sam poskusi znova.
   * Brez tega bi točke obtičale v brskalniku do naslednjega klika.
   */
  zacniVzdrzevanje() {
    setInterval(() => {
      if (!this.cakajoce || this.tece) return;
      if (!Oblak.jePovezan() || !navigator.onLine) return;
      this.poslji();
    }, 30000);
  },

  znacka() {
    const el = $('#znacka-sinhro');
    if (!el) return;
    const stanje = !Oblak.jePovezan() ? 'brez'
      : this.tece ? 'poteka'
      : Oblak.stanje === 'napaka' ? 'napaka'
      : this.cakajoce ? 'caka'
      : 'usklajeno';

    const besedilo = {
      brez:      'Samo ta računalnik',
      poteka:    'Shranjujem…',
      caka:      'Nesinhronizirano',
      usklajeno: 'Shranjeno na GitHub',
      napaka:    'Napaka pri shranjevanju',
    }[stanje];

    el.dataset.stanje = stanje;
    $('.znacka-besedilo', el).textContent = besedilo;
    el.title = stanje === 'napaka' ? Oblak.sporocilo
      : stanje === 'usklajeno' && this.zadnja
        ? 'Zadnjič shranjeno ' + new Date(this.zadnja).toLocaleString('sl-SI')
        : besedilo;
  },
};

/* ------------------------------------------------------------------ *
 * POMOŽNO
 * ------------------------------------------------------------------ */
const poKodi = new Map(DRZAVE.map(d => [d.k, d]));
const drzava = k => poKodi.get(k) || null;
const zastavaPot = k => 'assets/zastave/' + k + '.svg';

const strniProstor = s => (s || '').replace(/\s+/g, ' ').trim();

let obvestiloCas;
function obvesti(besedilo) {
  const el = $('#obvestilo');
  el.textContent = besedilo;
  el.classList.add('vidno');
  clearTimeout(obvestiloCas);
  obvestiloCas = setTimeout(() => el.classList.remove('vidno'), 2600);
}

/**
 * Slovensko ujemanje s števnikom: 1 zastava, 2 zastavi, 3 zastave, 5 zastav.
 * @param {number} n
 * @param {string[]} oblike [ednina, dvojina, 3–4, 5+]
 */
function sklon(n, oblike) {
  const o = Math.abs(n) % 100;
  if (o === 1) return oblike[0];
  if (o === 2) return oblike[1];
  if (o === 3 || o === 4) return oblike[2];
  return oblike[3];
}

function zapisiCas(s) {
  const m = Math.floor(Math.abs(s) / 60);
  const sek = Math.abs(s) % 60;
  return m + ':' + String(sek).padStart(2, '0');
}

function trenutniUcenci() {
  const s = Stanje.ucenci && Stanje.ucenci[Stanje.skupina];
  return s ? s.ucenci : [];
}

/** Vse, kar se spremeni, ko pridejo novi podatki od zunaj. */
function osveziPrikaze() {
  osveziVidene();
  if (!$('#lestvica').hidden) izrisiLestvico();
}

/* ------------------------------------------------------------------ *
 * UČENCI — z GitHuba, sicer iz popotniki.json
 * ------------------------------------------------------------------ */
const Ucenci = {
  veljaven(d) { return !!(d && d.A && Array.isArray(d.A.ucenci) && d.B && Array.isArray(d.B.ucenci)); },

  /** Zasilni vir, kadar GitHub ni nastavljen ali datoteka še nima imen. */
  async izDatoteke() {
    // Brez `no-store`: service worker to datoteko shrani, da seznam deluje
    // tudi brez povezave — v učilnici wi-fi ni vedno zanesljiv.
    try {
      const odziv = await fetch('popotniki.json');
      if (!odziv.ok) return null;
      const d = await odziv.json();
      return this.veljaven(d) ? d : null;
    } catch (e) { return null; }
  },
};

/**
 * Nov učenec sredi ure. Ime je ključ, na katerega so vezane točke, zato ga
 * pozneje ne spreminjamo — točke bi ostale brez lastnika. Novo ime gre na
 * konec seznama: tam ga je v mreži najlažje najti, obstoječi vrstni red pa
 * ostane tak, kot ga učitelj pozna.
 */
function dodajUcenca(ime, razred, skupina) {
  ime = strniProstor(ime);
  razred = strniProstor(razred);

  const skup = Stanje.ucenci && Stanje.ucenci[skupina];
  if (!skup) { obvesti('Seznama učencev ni — odpri Nastavitve in poveži GitHub.'); return false; }
  if (!ime) { obvesti('Vpiši ime učenca.'); return false; }
  if (skup.ucenci.some(u => u.ime.toLowerCase() === ime.toLowerCase())) {
    obvesti(ime + ' je že na seznamu skupine ' + skupina + '.');
    return false;
  }

  skup.ucenci.push({ ime, razred });
  shraniPodatke();
  osveziPrikaze();
  // ime se skoraj vedno konča s piko (priimek) — brez še ene na koncu
  obvesti('Dodano v skupino ' + skupina + ': ' + ime);
  return true;
}

/** Razredi, ki v skupini že so — da jih ni treba tipkati. */
function napolniRazrede(izbirnik, skupina) {
  const skup = Stanje.ucenci && Stanje.ucenci[skupina];
  const razredi = [...new Set((skup ? skup.ucenci : []).map(u => u.razred).filter(Boolean))].sort();
  const seznam = $(izbirnik);
  seznam.innerHTML = '';
  razredi.forEach(r => {
    const o = document.createElement('option');
    o.value = r;
    seznam.appendChild(o);
  });
}

/* ------------------------------------------------------------------ *
 * NAKLJUČNI IZBOR
 * ------------------------------------------------------------------ */
/** Države, ki so še na voljo za naključni izbor. */
function bazen(izpustiKode) {
  const izpusti = new Set(izpustiKode);
  let v = DRZAVE.filter(d => !izpusti.has(d.k));
  if (Stanje.celina) v = v.filter(d => d.c === Stanje.celina);
  if (Stanje.brezPonavljanja) {
    const videne = videneZa(Stanje.skupina);
    const sveze = v.filter(d => !videne.has(d.k));
    if (sveze.length) return { seznam: sveze, izcrpano: false };
    return { seznam: v, izcrpano: v.length > 0 };
  }
  return { seznam: v, izcrpano: false };
}

function nakljucna(izpustiKode) {
  const { seznam, izcrpano } = bazen(izpustiKode);
  if (!seznam.length) return { d: null, izcrpano: false };
  return { d: seznam[Math.floor(Math.random() * seznam.length)], izcrpano };
}

function mesajVse() {
  const vzete = [];
  let izcrpanoKje = false;
  for (let i = 0; i < MEST; i++) {
    const { d, izcrpano } = nakljucna(vzete);
    if (!d) {
      obvesti(Stanje.celina ? 'Za to celino ni dovolj držav.' : 'Ni več držav na voljo.');
      break;
    }
    if (izcrpano) izcrpanoKje = true;
    Stanje.mesta[i] = { k: d.k, skrito: true };
    vzete.push(d.k);
  }
  if (izcrpanoKje) obvesti('Vse zastave iz tega izbora so že bile — začenjam znova.');
  shraniStanje();
  izrisiPripravo();
}

function mesajEno(i) {
  const vzete = Stanje.mesta.map(m => m.k).filter((k, j) => k && j !== i);
  const { d } = nakljucna(vzete);
  if (!d) { obvesti('Ni več držav na voljo.'); return; }
  Stanje.mesta[i].k = d.k;
  shraniStanje();
  izrisiPripravo();
}

/* ------------------------------------------------------------------ *
 * PRIPRAVA
 * ------------------------------------------------------------------ */
let moznostiHtml = null;
function moznosti() {
  if (moznostiHtml === null) {
    moznostiHtml = '<option value="">— izberi državo —</option>' +
      DRZAVE.map(d => `<option value="${d.k}">${d.sl}</option>`).join('');
  }
  return moznostiHtml;
}

function izrisiPripravo() {
  const mreza = $('#mreza-priprava');
  mreza.innerHTML = '';

  Stanje.mesta.forEach((mesto, i) => {
    const d = mesto.k ? drzava(mesto.k) : null;
    const el = document.createElement('div');
    el.className = 'mesto' + (mesto.skrito ? ' skrito' : '');
    el.innerHTML = `
      <div class="mesto-vrh">
        <span class="mesto-st">${i + 1}</span>
        <select aria-label="Država ${i + 1}">${moznosti()}</select>
        <button class="ikona" data-mesaj="${i}" title="Naključna država">🎲</button>
        <button class="ikona${mesto.skrito ? ' ugasnjeno' : ''}" data-oko="${i}"
                title="${mesto.skrito ? 'Ime je skrito' : 'Ime je vidno'}"
                aria-pressed="${!mesto.skrito}">👁</button>
      </div>
      <div class="mesto-zastava">
        ${d ? `<img src="${zastavaPot(d.k)}" alt="Zastava: ${d.sl}">` : '<span class="prazno">brez zastave</span>'}
      </div>
      <div class="mesto-ime">
        ${d ? `${d.sl} <span class="celina">· ${d.c}</span>` : '—'}
      </div>`;

    const izbira = $('select', el);
    izbira.value = mesto.k || '';
    izbira.addEventListener('change', () => {
      Stanje.mesta[i].k = izbira.value || null;
      shraniStanje();
      izrisiPripravo();
    });

    mreza.appendChild(el);
  });

  const polnih = Stanje.mesta.filter(m => m.k).length;
  $('#zacni-kviz').disabled = polnih === 0;
  $('#zacni-kviz').textContent = polnih === MEST ? 'Začni kviz ▸' : `Začni kviz (${polnih}) ▸`;
  osveziVidene();
}

function osveziVidene() {
  const n = videneZa(Stanje.skupina).size;
  $('#videne-stevec').textContent = n ? `(${n} od ${DRZAVE.length})` : '';
  const opis = $('#videne-opis');
  if (opis) {
    const a = videneZa('A').size, b = videneZa('B').size;
    const zastav = x => sklon(x, ['zastavo', 'zastavi', 'zastave', 'zastav']);
    opis.textContent = `Skupina A je videla ${a} ${zastav(a)}, ` +
                       `skupina B ${b} ${zastav(b)} — od ${DRZAVE.length}.`;
  }
}

/* ------------------------------------------------------------------ *
 * KVIZ
 * ------------------------------------------------------------------ */
function zacniKviz() {
  const polna = Stanje.mesta.filter(m => m.k);
  if (!polna.length) { obvesti('Najprej izberi vsaj eno državo.'); return; }

  // id veže vseh 6 razkritij v en krog — isto državo lahko drug dan vprašamo znova
  Stanje.kviz = { id: new Date().toISOString(), razkrite: new Set(), aktivno: null };
  $('#kviz-skupina').textContent = Stanje.ucenci
    ? Stanje.ucenci[Stanje.skupina].naziv
    : 'Skupina ' + Stanje.skupina;

  Casovnik.ponastavi();
  izrisiKviz();
  preklopiZaslon('kviz');
}

function izrisiKviz() {
  const mreza = $('#mreza-kviz');
  mreza.innerHTML = '';

  Stanje.mesta.forEach((mesto, i) => {
    if (!mesto.k) return;
    const d = drzava(mesto.k);
    if (!d) return;

    const razkrita = Stanje.kviz.razkrite.has(i);
    const vidnoIme = razkrita || !mesto.skrito;

    const el = document.createElement('button');
    el.className = 'kartica' + (razkrita ? ' koncana' : '');
    el.type = 'button';
    el.setAttribute('aria-label', `Zastava ${i + 1}${razkrita ? ': ' + d.sl : ''}`);
    el.innerHTML = `
      <span class="kartica-st">${i + 1}</span>
      <div class="kartica-zastava"><img src="${zastavaPot(d.k)}" alt=""></div>
      <div class="kartica-ime${vidnoIme ? '' : ' zakrito'}">${vidnoIme ? d.sl : ''}</div>`;
    el.addEventListener('click', () => odpriRazkritje(i));
    mreza.appendChild(el);
  });

  osveziGumbRazkrij();
}

function naslednjaNerazkrita() {
  for (let i = 0; i < MEST; i++) {
    if (Stanje.mesta[i].k && !Stanje.kviz.razkrite.has(i)) return i;
  }
  return -1;
}

function osveziGumbRazkrij() {
  const i = naslednjaNerazkrita();
  const g = $('#razkrij-naslednjo');
  if (i === -1) {
    g.textContent = 'Zaključi in poglej lestvico';
    g.onclick = () => { preklopiZaslon('priprava'); odpriLestvico(); };
  } else {
    g.textContent = `Razkrij ${i + 1} ▸`;
    g.onclick = () => odpriRazkritje(i);
  }
}

/* ------------------------------------------------------------------ *
 * ČASOVNIK
 * ------------------------------------------------------------------ */
const Casovnik = {
  preostalo: 0,
  ura: null,
  tece: false,

  ponastavi() {
    this.ustavi();
    this.preostalo = Stanje.sekund;
    this.izrisi();
    $('#cas-zacni').textContent = 'Začni ' + zapisiCas(Stanje.sekund);
  },

  preklopi() {
    if (this.tece) { this.ustavi(); $('#cas-zacni').textContent = 'Nadaljuj'; return; }
    if (this.preostalo <= 0) this.preostalo = Stanje.sekund;
    this.tece = true;
    $('#cas-zacni').textContent = 'Ustavi';
    const konec = Date.now() + this.preostalo * 1000;
    this.ura = setInterval(() => {
      this.preostalo = Math.max(0, Math.round((konec - Date.now()) / 1000));
      this.izrisi();
      if (this.preostalo === 0) { this.ustavi(); $('#cas-zacni').textContent = 'Znova'; this.zapisk(); }
    }, 250);
  },

  ustavi() {
    clearInterval(this.ura);
    this.ura = null;
    this.tece = false;
  },

  izrisi() {
    $('#cas-prikaz').textContent = zapisiCas(this.preostalo);
    const ovoj = $('#casovnik');
    ovoj.classList.toggle('izteka', this.preostalo > 0 && this.preostalo <= 30);
    ovoj.classList.toggle('konec', this.preostalo === 0);
  },

  zapisk() {
    if (!Stanje.zvok) return;
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.28, 0.56].forEach(zamik => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine';
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, ac.currentTime + zamik);
        g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + zamik + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + zamik + 0.20);
        o.connect(g); g.connect(ac.destination);
        o.start(ac.currentTime + zamik);
        o.stop(ac.currentTime + zamik + 0.22);
      });
      setTimeout(() => ac.close(), 1200);
    } catch (e) { /* brez zvoka gre tudi */ }
  },
};

/* ------------------------------------------------------------------ *
 * RAZKRITJE IN TOČKOVANJE
 * ------------------------------------------------------------------ */
/** Zapis kroga za eno zastavo; nastane ob prvem razkritju. */
function zapisKroga(kodaDrzave) {
  const id = Stanje.kviz.id + ':' + kodaDrzave;
  let z = Stanje.krogi.find(v => v.id === id);
  if (!z) {
    const zdaj = new Date().toISOString();
    z = { id, cas: zdaj, spremenjeno: zdaj, skupina: Stanje.skupina, drzava: kodaDrzave, pravilni: [] };
    Stanje.krogi.push(z);
    if (Stanje.krogi.length > KROGI_MEJA) {
      Stanje.krogi.splice(0, Stanje.krogi.length - KROGI_MEJA);
    }
  }
  return z;
}

function odpriRazkritje(i) {
  const mesto = Stanje.mesta[i];
  if (!mesto || !mesto.k) return;
  const d = drzava(mesto.k);
  if (!d) return;

  Stanje.kviz.aktivno = i;
  Stanje.kviz.razkrite.add(i);
  zapisKroga(d.k);          // zapis nastane ob razkritju → zastava velja za „videno"
  shraniPodatke();

  $('#razkritje-stevilka').textContent = i + 1;
  $('#razkritje-zastava').src = zastavaPot(d.k);
  $('#razkritje-zastava').alt = 'Zastava: ' + d.sl;
  $('#razkritje-ime').textContent = d.sl;
  $('#razkritje-pod').textContent = `${d.c} · ${d.en}`;

  izrisiUcence();
  preklopiHitroDodajanje(false);
  $('#razkritje').hidden = false;
  izrisiKviz();
}

function izrisiUcence() {
  const ovoj = $('#ucenci');
  ovoj.innerHTML = '';
  const seznam = trenutniUcenci();
  $('#dodaj-hitro').hidden = !Stanje.ucenci;

  if (!seznam.length) {
    ovoj.innerHTML = '<p class="prazno">Seznam učencev ni naložen — točk ni mogoče zapisati. ' +
                     'Odpri <strong>Nastavitve → Shramba na GitHubu</strong>.</p>';
    osveziStevec();
    return;
  }

  const krog = zapisKroga(drzava(Stanje.mesta[Stanje.kviz.aktivno].k).k);

  seznam.forEach(u => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'ucenec' + (krog.pravilni.includes(u.ime) ? ' pravilno' : '');
    el.setAttribute('aria-pressed', krog.pravilni.includes(u.ime));
    el.innerHTML = `${u.ime}<small>${u.razred}</small>`;
    el.addEventListener('click', () => preklopiUcenca(u.ime));
    ovoj.appendChild(el);
  });

  osveziStevec();
}

/** Vrstica pod mrežo: gumb „+ učenec" ali odprti polji. */
function preklopiHitroDodajanje(odpri) {
  $('#hitro-polja').hidden = !odpri;
  $('#odpri-hitro').hidden = odpri;
  if (!odpri) return;
  napolniRazrede('#razredi-hitro', Stanje.skupina);
  $('#hitro-ime').value = '';
  $('#hitro-razred').value = '';
  $('#hitro-ime').focus();
}

function hitroDodaj() {
  if (!dodajUcenca($('#hitro-ime').value, $('#hitro-razred').value, Stanje.skupina)) {
    $('#hitro-ime').focus();
    return;
  }
  izrisiUcence();
  preklopiHitroDodajanje(false);
  // novo ime je na koncu mreže — naj se vidi
  const ovoj = $('#ucenci');
  ovoj.scrollTop = ovoj.scrollHeight;
}

/** Ena točka za eno pravilno ime pri eni zastavi; drugi klik jo vzame nazaj. */
function nastaviUcenca(krog, ime, pravilno) {
  const kje = krog.pravilni.indexOf(ime);
  if (pravilno && kje === -1) krog.pravilni.push(ime);
  else if (!pravilno && kje !== -1) krog.pravilni.splice(kje, 1);
  else return false;
  krog.spremenjeno = new Date().toISOString();
  return true;
}

function preklopiUcenca(ime) {
  const krog = zapisKroga(drzava(Stanje.mesta[Stanje.kviz.aktivno].k).k);
  nastaviUcenca(krog, ime, !krog.pravilni.includes(ime));
  shraniPodatke();
  izrisiUcence();
}

function vsiUcenci(pravilno) {
  const krog = zapisKroga(drzava(Stanje.mesta[Stanje.kviz.aktivno].k).k);
  trenutniUcenci().forEach(u => nastaviUcenca(krog, u.ime, pravilno));
  shraniPodatke();
  izrisiUcence();
}

function osveziStevec() {
  const aktivno = Stanje.kviz && Stanje.kviz.aktivno;
  if (aktivno === null || aktivno === undefined) return;
  const d = drzava(Stanje.mesta[aktivno].k);
  const n = zapisKroga(d.k).pravilni.length;
  const skupaj = trenutniUcenci().length;
  $('#stevec-pravilnih').textContent = skupaj ? `${n} od ${skupaj} učencev` : '0 učencev';
}

function zapriRazkritje() {
  $('#razkritje').hidden = true;
  Stanje.kviz.aktivno = null;
  izrisiKviz();
  Sinhro.poslji();          // konec zastave = dober trenutek za zapis
}

function naprej() {
  const i = naslednjaNerazkrita();
  if (i === -1) {
    zapriRazkritje();
    obvesti('Vseh 6 zastav je razkritih.');
    odpriLestvico();
    return;
  }
  odpriRazkritje(i);
}

/* ------------------------------------------------------------------ *
 * LESTVICA
 * ------------------------------------------------------------------ */
let lestvicaSkupina = null;

function odpriLestvico(skupina) {
  lestvicaSkupina = skupina || Stanje.skupina;
  $$('#lestvica-zavihki .zavihek').forEach(z =>
    z.classList.toggle('on', z.dataset.lestvica === lestvicaSkupina));
  izrisiLestvico();
  $('#lestvica').hidden = false;
}

function izrisiLestvico() {
  const s = lestvicaSkupina;
  const seznam = (Stanje.ucenci && Stanje.ucenci[s]) ? Stanje.ucenci[s].ucenci : [];
  const tocke = tockeZa(s);
  const tabela = $('#tabela-lestvice');

  if (!seznam.length) {
    tabela.innerHTML = '<tr><td class="prazno">Seznam učencev ni naložen.</td></tr>';
    $('#lestvica-drobno').textContent = '';
    return;
  }

  const vrstice = seznam
    .map(u => ({ ...u, t: tocke[u.ime] || 0 }))
    .sort((a, b) => b.t - a.t || a.ime.localeCompare(b.ime, 'sl'));

  const najvec = vrstice[0].t;
  let mesto = 0, prej = null, prikaz = 0;

  tabela.innerHTML =
    '<thead><tr><th></th><th>Učenec</th><th>Razred</th><th style="text-align:right">Točke</th></tr></thead><tbody>' +
    vrstice.map(v => {
      mesto++;
      if (v.t !== prej) { prikaz = mesto; prej = v.t; }
      const vrh = v.t > 0 && v.t === najvec;
      return `<tr class="${vrh ? 'vrh' : ''}">
        <td class="st">${v.t > 0 ? prikaz + '.' : ''}</td>
        <td>${v.ime}</td>
        <td class="razred">${v.razred}</td>
        <td class="tocke">${v.t}</td>
      </tr>`;
    }).join('') + '</tbody>';

  const krogi = Stanje.krogi.filter(z => z.skupina === s).length;
  const skupaj = vrstice.reduce((v, x) => v + x.t, 0);
  const razlicnih = videneZa(s).size;
  $('#lestvica-drobno').textContent =
    `${krogi} ${sklon(krogi, ['razkrita zastava', 'razkriti zastavi', 'razkrite zastave', 'razkritih zastav'])} · ` +
    `${skupaj} ${sklon(skupaj, ['podeljena točka', 'podeljeni točki', 'podeljene točke', 'podeljenih točk'])} · ` +
    `${razlicnih} ${sklon(razlicnih, ['različna zastava', 'različni zastavi', 'različne zastave', 'različnih zastav'])}.`;
}

/* ------------------------------------------------------------------ *
 * VARNOSTNA KOPIJA (poleg GitHuba)
 * ------------------------------------------------------------------ */
function prenesi(imeDatoteke, vsebina, tip) {
  const blob = new Blob([vsebina], { type: tip || 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = imeDatoteke;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function izvoziJson() {
  prenesi(`popotniki-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(Sinhro.dokument(null), null, 1));
  obvesti('Varnostna kopija shranjena.');
}

function uvoziJson(besedilo) {
  let d;
  try { d = JSON.parse(besedilo); } catch (e) { obvesti('Datoteke ni bilo mogoče prebrati.'); return; }
  if (!d || !Array.isArray(d.krogi)) { obvesti('V datoteki ni zapisov krogov.'); return; }
  if (!confirm('Zapise iz datoteke zlijem s trenutnimi. Nadaljujem?')) return;

  Stanje.krogi = zlijKroge(Stanje.krogi, d.krogi);
  if (d.ucenci && Ucenci.veljaven(d.ucenci)) Stanje.ucenci = d.ucenci;
  if (d.zacetekZastav) Stanje.zacetekZastav = d.zacetekZastav;
  shraniPodatke();
  osveziPrikaze();
  obvesti('Zapisi naloženi.');
}

/* ------------------------------------------------------------------ *
 * ZASLONI
 * ------------------------------------------------------------------ */
function preklopiZaslon(ime) {
  $('#zaslon-priprava').classList.toggle('on', ime === 'priprava');
  $('#zaslon-kviz').classList.toggle('on', ime === 'kviz');
  if (ime === 'priprava') { Casovnik.ustavi(); izrisiPripravo(); }
}

function zapriPrekrivala() {
  $('#razkritje').hidden = true;
  $('#lestvica').hidden = true;
  $('#nastavitve').hidden = true;
  if (Stanje.kviz) { Stanje.kviz.aktivno = null; izrisiKviz(); }
}

/* ------------------------------------------------------------------ *
 * NASTAVITVE SHRAMBE
 * ------------------------------------------------------------------ */
function izrisiPovezavo() {
  const n = Oblak.nastavitve;
  const povezan = Oblak.jePovezan();

  $('#repo-pot').value = n.lastnik && n.repo ? `${n.lastnik}/${n.repo}` : '';
  $('#zeton-trajno').checked = n.trajno !== false;
  $('#odjavi').hidden = !povezan;
  $('#sinhroniziraj').hidden = !povezan;
  $('#povezi').textContent = povezan ? 'Preveri znova' : 'Poveži';

  const st = $('#povezava-stanje');
  if (!povezan) {
    st.className = 'drobno';
    st.textContent = 'Ni povezano — točke ostanejo samo v tem brskalniku.';
  } else if (Oblak.stanje === 'napaka') {
    st.className = 'drobno napaka';
    st.textContent = Oblak.sporocilo;
  } else {
    st.className = 'drobno';
    st.textContent = `Povezano z ${n.lastnik}/${n.repo}` +
      (Sinhro.zadnja ? ` · zadnjič shranjeno ${new Date(Sinhro.zadnja).toLocaleString('sl-SI')}` : '') +
      (Sinhro.cakajoce ? ' · nekaj še čaka na zapis' : '');
  }
}

async function povezi() {
  const st = $('#povezava-stanje');
  const pot = $('#repo-pot').value.trim()
    .replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '').replace(/\s+/g, '');
  /* Kopiranje iz zapiskov, klepetov in spletnih strani rado prinese nevidne
     znake — ničelno široke presledke, trde presledke, smerne oznake. `trim()`
     jih ne pobere, GitHub pa žeton zavrne brez pojasnila. Žeton je sestavljen
     samo iz črk, številk in podčrtajev, zato vse ostalo odstranimo. */
  const zeton = $('#zeton').value.replace(/[^A-Za-z0-9_]/g, '');
  const trajno = $('#zeton-trajno').checked;

  const [lastnik, repo] = pot.split('/');
  if (!lastnik || !repo) {
    st.className = 'drobno napaka';
    st.textContent = 'Vpiši repozitorij v obliki lastnik/ime, npr. nicki89-blip/popotniki-tocke.';
    return;
  }
  if (!zeton && !Oblak.nastavitve.zeton) {
    st.className = 'drobno napaka';
    st.textContent = 'Vpiši žeton.';
    return;
  }

  Oblak.nastavitve = { lastnik, repo, trajno, zeton: zeton || Oblak.nastavitve.zeton };
  st.className = 'drobno';
  st.textContent = 'Preverjam…';

  const rez = await Oblak.preveri();
  if (!rez.ok) {
    st.className = 'drobno napaka';
    /* Pri napačnem žetonu povemo dolžino in zadnje znake: daleč najpogostejši
       vzrok je odrezano lepljenje, ker GitHub žeton prikaže v prirezanem
       polju. Fine-grained žeton ima okoli 93 znakov. */
    const z = Oblak.nastavitve.zeton || '';
    const namig = /žeton/i.test(rez.napaka) && z
      ? ` Vpisani žeton ima ${z.length} ${sklon(z.length, ['znak', 'znaka', 'znake', 'znakov'])}` +
        ` in se konča na „…${z.slice(-4)}".` +
        (z.length < 80 ? ' To je prekratko — verjetno je bil prilepljen odrezan.' : '')
      : '';
    st.textContent = rez.napaka + namig;
    return;
  }

  Povezava.pisi(Oblak.nastavitve);
  $('#zeton').value = '';

  if (!rez.zaseben) {
    obvesti('Opozorilo: ta repozitorij je javen — točke bodo vidne vsem.');
  }

  // imena, ki jih imamo lokalno, ponesemo gor ob prvi povezavi
  if (!Stanje.ucenci) {
    const izDatoteke = await Ucenci.izDatoteke();
    if (izDatoteke) Stanje.ucenci = izDatoteke;
  }

  await Sinhro.potegni();
  izrisiPovezavo();
  osveziPrikaze();
  izrisiPripravo();
  obvesti(rez.kdo ? `Povezano kot ${rez.kdo}.` : 'Povezano z GitHubom.');
}

/* ------------------------------------------------------------------ *
 * POVEZOVANJE
 * ------------------------------------------------------------------ */
function poveziDogodke() {
  // ---- glava
  $$('.skupina').forEach(g => g.addEventListener('click', () => {
    Stanje.skupina = g.dataset.skupina;
    $$('.skupina').forEach(x => x.classList.toggle('on', x === g));
    shraniStanje();
    osveziVidene();
    if (Stanje.kviz) {
      $('#kviz-skupina').textContent = Stanje.ucenci
        ? Stanje.ucenci[Stanje.skupina].naziv : 'Skupina ' + Stanje.skupina;
    }
  }));
  $('#odpri-lestvico').addEventListener('click', () => odpriLestvico());
  $('#odpri-nastavitve').addEventListener('click', odpriNastavitve);
  $('#znacka-sinhro').addEventListener('click', odpriNastavitve);

  // ---- priprava
  $('#mesaj-vse').addEventListener('click', mesajVse);
  $('#izprazni').addEventListener('click', () => {
    Stanje.mesta = Array.from({ length: MEST }, () => ({ k: null, skrito: true }));
    shraniStanje();
    izrisiPripravo();
  });
  $('#pokazi-vsa-imena').addEventListener('click', () => {
    Stanje.mesta.forEach(m => m.skrito = false); shraniStanje(); izrisiPripravo();
  });
  $('#skrij-vsa-imena').addEventListener('click', () => {
    Stanje.mesta.forEach(m => m.skrito = true); shraniStanje(); izrisiPripravo();
  });
  $('#zacni-kviz').addEventListener('click', zacniKviz);

  $('#mreza-priprava').addEventListener('click', e => {
    const mesaj = e.target.closest('[data-mesaj]');
    if (mesaj) { mesajEno(+mesaj.dataset.mesaj); return; }
    const oko = e.target.closest('[data-oko]');
    if (oko) {
      const i = +oko.dataset.oko;
      Stanje.mesta[i].skrito = !Stanje.mesta[i].skrito;
      shraniStanje();
      izrisiPripravo();
    }
  });

  const celina = $('#filter-celina');
  CELINE.forEach(c => celina.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`));
  celina.value = Stanje.celina;
  celina.addEventListener('change', () => { Stanje.celina = celina.value; shraniStanje(); });

  const brezPon = $('#brez-ponavljanja');
  brezPon.checked = Stanje.brezPonavljanja;
  brezPon.addEventListener('change', () => { Stanje.brezPonavljanja = brezPon.checked; shraniStanje(); });

  // ---- kviz
  $('#nazaj-na-pripravo').addEventListener('click', () => preklopiZaslon('priprava'));
  $('#cas-zacni').addEventListener('click', () => Casovnik.preklopi());
  $('#cas-ponastavi').addEventListener('click', () => Casovnik.ponastavi());

  // ---- razkritje
  $('#zapri-razkritje').addEventListener('click', zapriRazkritje);
  $('#naprej').addEventListener('click', naprej);
  $('#vsi-pravilno').addEventListener('click', () => vsiUcenci(true));
  $('#nihce-pravilno').addEventListener('click', () => vsiUcenci(false));

  $('#odpri-hitro').addEventListener('click', () => preklopiHitroDodajanje(true));
  $('#hitro-preklici').addEventListener('click', () => preklopiHitroDodajanje(false));
  $('#hitro-dodaj').addEventListener('click', hitroDodaj);
  ['#hitro-ime', '#hitro-razred'].forEach(izb => $(izb).addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); hitroDodaj(); }
    if (e.key === 'Escape') { e.preventDefault(); preklopiHitroDodajanje(false); }
  }));

  // ---- lestvica
  $$('#lestvica-zavihki .zavihek').forEach(z =>
    z.addEventListener('click', () => odpriLestvico(z.dataset.lestvica)));

  // ---- nastavitve
  $('#nastavi-cas').addEventListener('change', e => {
    const v = Math.min(900, Math.max(15, +e.target.value || 120));
    Stanje.sekund = v; e.target.value = v; shraniStanje();
    if (!Casovnik.tece) Casovnik.ponastavi();
  });
  $('#nastavi-zvok').addEventListener('change', e => { Stanje.zvok = e.target.checked; shraniStanje(); });

  $('#pozabi-videne').addEventListener('click', () => {
    if (!confirm('Zastave bodo spet lahko prišle na vrsto. Točke ostanejo. Nadaljujem?')) return;
    const zdaj = new Date().toISOString();
    Stanje.zacetekZastav = { A: zdaj, B: zdaj };
    shraniPodatke();
    osveziVidene();
    obvesti('Izbor zastav se začne znova. Točke so ostale.');
  });

  $('#nov-skupina').addEventListener('change', izrisiUcenceNastavitve);
  $('#dodaj-ucenca').addEventListener('click', dodajIzNastavitev);
  ['#nov-ime', '#nov-razred'].forEach(izb => $(izb).addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); dodajIzNastavitev(); }
  }));

  $('#izvozi-json').addEventListener('click', izvoziJson);
  $('#uvozi-json').addEventListener('click', () => $('#datoteka-uvoz').click());
  $('#datoteka-uvoz').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then(uvoziJson);
    e.target.value = '';
  });
  $('#ponastavi-tocke').addEventListener('click', () => {
    if (!confirm('Res izbrišem vse točke obeh skupin, tudi na GitHubu? Tega ni mogoče razveljaviti.')) return;
    Stanje.krogi = [];
    Stanje.zacetekZastav = { A: null, B: null };
    shraniPodatke();
    osveziPrikaze();
    obvesti('Točke ponastavljene.');
  });

  // ---- shramba na GitHubu
  $('#povezi').addEventListener('click', povezi);
  $('#zeton').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); povezi(); } });
  $('#sinhroniziraj').addEventListener('click', async () => {
    await Sinhro.potegni();
    izrisiPovezavo();
    osveziPrikaze();
    izrisiPripravo();
  });
  $('#odjavi').addEventListener('click', () => {
    if (!confirm('Odklopim ta računalnik od GitHuba? Točke tam ostanejo nedotaknjene.')) return;
    Povezava.pozabi();
    Oblak.nastavitve = Povezava.beri();
    Oblak.sha = null;
    Oblak._javi('brez');
    Sinhro.znacka();
    izrisiPovezavo();
    obvesti('Odklopljeno.');
  });

  // ---- zapiranje prekrival
  $$('[data-zapri]').forEach(g => g.addEventListener('click', zapriPrekrivala));
  $$('.prekrivalo').forEach(p => p.addEventListener('mousedown', e => {
    if (e.target === p) zapriPrekrivala();
  }));

  // ---- tipkovnica
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea')) return;

    if (e.key === 'Escape') {
      if (!$('#razkritje').hidden) { zapriRazkritje(); return; }
      zapriPrekrivala();
      return;
    }
    if (!$('#razkritje').hidden) {
      if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); naprej(); }
      return;
    }
    if (!$('#zaslon-kviz').classList.contains('on')) return;

    if (e.key === ' ') { e.preventDefault(); Casovnik.preklopi(); return; }
    if (e.key >= '1' && e.key <= '6') {
      const i = +e.key - 1;
      if (Stanje.mesta[i] && Stanje.mesta[i].k) { e.preventDefault(); odpriRazkritje(i); }
    }
  });

  // ---- omrežje se vrne / zavihek se zapira
  window.addEventListener('online', () => { if (Sinhro.cakajoce) Sinhro.poslji(); });
  window.addEventListener('beforeunload', e => {
    if (Sinhro.cakajoce && Oblak.jePovezan()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

/** Razdelek „Učenci" v nastavitvah — za skupino, izbrano v spustnem meniju. */
function izrisiUcenceNastavitve() {
  const s = $('#nov-skupina').value;
  const skup = Stanje.ucenci && Stanje.ucenci[s];
  $('#ucenci-opis').textContent = skup
    ? `${skup.naziv} — ${skup.ucenci.length} ${sklon(skup.ucenci.length, ['učenec', 'učenca', 'učenci', 'učencev'])}.`
    : 'Seznama učencev ni. Poveži GitHub ali naloži varnostno kopijo.';
  $('#dodaj-ucenca').disabled = !skup;
  napolniRazrede('#razredi-nastavitve', s);
}

function dodajIzNastavitev() {
  const s = $('#nov-skupina').value;
  if (!dodajUcenca($('#nov-ime').value, $('#nov-razred').value, s)) { $('#nov-ime').focus(); return; }
  $('#nov-ime').value = '';
  $('#nov-razred').value = '';
  $('#nov-ime').focus();
  izrisiUcenceNastavitve();
  if (!$('#razkritje').hidden) izrisiUcence();
}

function odpriNastavitve() {
  $('#nastavi-cas').value = Stanje.sekund;
  $('#nastavi-zvok').checked = Stanje.zvok;
  osveziVidene();
  $('#nov-skupina').value = Stanje.skupina;
  $('#nov-ime').value = '';
  $('#nov-razred').value = '';
  izrisiUcenceNastavitve();
  izrisiPovezavo();
  $('#nastavitve').hidden = false;
}

/* ------------------------------------------------------------------ *
 * ZAGON
 * ------------------------------------------------------------------ */
async function zagon() {
  $$('.skupina').forEach(g => g.classList.toggle('on', g.dataset.skupina === Stanje.skupina));
  poveziDogodke();
  Oblak.naStanje(() => Sinhro.znacka());
  Sinhro.zacniVzdrzevanje();
  Sinhro.znacka();
  izrisiPripravo();

  if (Oblak.jePovezan()) {
    await Sinhro.potegni();
  }
  if (!Stanje.ucenci) {
    const izDatoteke = await Ucenci.izDatoteke();
    if (izDatoteke) {
      Stanje.ucenci = izDatoteke;
      Shramba.pisi('ucenci', izDatoteke);
      if (Oblak.jePovezan()) Sinhro.naroci();   // ponesemo imena na GitHub
    }
  }

  if (!Stanje.ucenci) {
    obvesti('Seznama učencev ni — odpri Nastavitve in poveži GitHub.');
  } else if (!Oblak.jePovezan()) {
    obvesti('Točke se zaenkrat shranjujejo samo v ta brskalnik.');
  }

  osveziPrikaze();
  izrisiPripravo();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

zagon();
