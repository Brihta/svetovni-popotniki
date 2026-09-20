/* =====================================================================
   Svetovni popotniki — shramba na GitHubu
   Točke se zbirajo v različnih učilnicah, zato ne smejo živeti v enem
   brskalniku. Edini zapis, ki šteje, je datoteka v zasebnem repozitoriju;
   brskalnik ima samo delovno kopijo.

   Žeton je osebna skrivnost in ostane na tem računalniku (localStorage ali
   samo do konca seje). V repozitorij ne gre nikoli.
   ===================================================================== */
'use strict';

const OBLAK_DATOTEKA = 'podatki.json';

/* ---------------- base64 za UTF-8 (šumniki!) ---------------- */
function vBase64(niz) {
  const bajti = new TextEncoder().encode(niz);
  let s = '';
  // po kosih, ker String.fromCharCode(...) pri velikih poljih poči
  for (let i = 0; i < bajti.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bajti.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function izBase64(b64) {
  const cist = b64.replace(/\s/g, '');
  const bajti = Uint8Array.from(atob(cist), c => c.charCodeAt(0));
  return new TextDecoder().decode(bajti);
}

/* ---------------- nastavitve povezave ---------------- */
const Povezava = {
  beri() {
    let n = null;
    try { n = JSON.parse(localStorage.getItem('popotniki_povezava')); } catch (e) {}
    if (!n) n = { lastnik: '', repo: '', trajno: true };
    // žeton je lahko samo za to sejo (skupni računalnik v učilnici)
    if (!n.zeton) {
      try { n.zeton = sessionStorage.getItem('popotniki_zeton') || ''; } catch (e) { n.zeton = ''; }
    }
    return n;
  },
  pisi(n) {
    const { zeton, trajno, ...brezZetona } = n;
    try {
      localStorage.setItem('popotniki_povezava', JSON.stringify(
        trajno ? { ...brezZetona, trajno, zeton } : { ...brezZetona, trajno }
      ));
      if (trajno) sessionStorage.removeItem('popotniki_zeton');
      else sessionStorage.setItem('popotniki_zeton', zeton || '');
    } catch (e) {}
  },
  pozabi() {
    try {
      localStorage.removeItem('popotniki_povezava');
      sessionStorage.removeItem('popotniki_zeton');
    } catch (e) {}
  },
};

/* ---------------- GitHub API ---------------- */
const Oblak = {
  nastavitve: Povezava.beri(),
  sha: null,
  /** 'brez' | 'usklajeno' | 'poteka' | 'caka' | 'napaka' */
  stanje: 'brez',
  sporocilo: '',
  poslusalci: [],

  jePovezan() {
    const n = this.nastavitve;
    return !!(n.zeton && n.lastnik && n.repo);
  },

  naStanje(f) { this.poslusalci.push(f); },
  _javi(stanje, sporocilo = '') {
    this.stanje = stanje;
    this.sporocilo = sporocilo;
    this.poslusalci.forEach(f => { try { f(stanje, sporocilo); } catch (e) {} });
  },

  async _klic(pot, moznosti = {}) {
    const odziv = await fetch('https://api.github.com' + pot, {
      ...moznosti,
      headers: {
        Authorization: 'Bearer ' + this.nastavitve.zeton,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(moznosti.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    return odziv;
  },

  /** Preveri žeton in dostop do repozitorija. Vrne { ok, kdo, napaka }. */
  async preveri() {
    try {
      const jaz = await this._klic('/user');
      if (jaz.status === 401) return { ok: false, napaka: 'Žeton ni veljaven ali je potekel.' };
      if (!jaz.ok) return { ok: false, napaka: 'GitHub je odgovoril s kodo ' + jaz.status + '.' };
      const kdo = (await jaz.json()).login;

      const r = await this._klic(`/repos/${this.nastavitve.lastnik}/${this.nastavitve.repo}`);
      if (r.status === 404) {
        return { ok: false, napaka: 'Repozitorija ni ali pa mu žeton nima dostopa. ' +
                                    'Pri fine-grained žetonu preveri, da je ta repozitorij izbran.' };
      }
      if (!r.ok) return { ok: false, napaka: 'Repozitorij: koda ' + r.status + '.' };

      const podatki = await r.json();
      if (!podatki.permissions || !podatki.permissions.push) {
        return { ok: false, napaka: 'Žeton nima pravice pisanja (Contents: Read and write).' };
      }
      return { ok: true, kdo, zaseben: podatki.private };
    } catch (e) {
      return { ok: false, napaka: 'Ni povezave z GitHubom.' };
    }
  },

  /** Prenese datoteko. Vrne { podatki, sha } ali { podatki:null } če je še ni. */
  async prenesi() {
    const { lastnik, repo } = this.nastavitve;
    const odziv = await this._klic(
      `/repos/${lastnik}/${repo}/contents/${OBLAK_DATOTEKA}?ref=HEAD&t=${Date.now()}`,
      { cache: 'no-store' }
    );
    if (odziv.status === 404) { this.sha = null; return { podatki: null, sha: null }; }
    if (!odziv.ok) throw new Error('Branje ni uspelo (koda ' + odziv.status + ').');

    const telo = await odziv.json();
    this.sha = telo.sha;
    let podatki = null;
    try { podatki = JSON.parse(izBase64(telo.content)); }
    catch (e) { throw new Error('Datoteka na GitHubu ni veljaven JSON.'); }
    return { podatki, sha: telo.sha };
  },

  /**
   * Zapiše datoteko. Če je medtem nekdo drug pisal (drug računalnik),
   * GitHub zavrne zapis — takrat znova preberemo, zlijemo in poskusimo še enkrat.
   * @param {(oddaljeni:object|null)=>object} sestavi vrne vsebino za zapis
   */
  async zapisi(sestavi, sporocilo, poskus = 0) {
    const { lastnik, repo } = this.nastavitve;
    const vsebina = sestavi(null);

    const telo = {
      message: sporocilo,
      content: vBase64(JSON.stringify(vsebina, null, 1)),
      ...(this.sha ? { sha: this.sha } : {}),
    };

    const odziv = await this._klic(`/repos/${lastnik}/${repo}/contents/${OBLAK_DATOTEKA}`, {
      method: 'PUT',
      body: JSON.stringify(telo),
    });

    if (odziv.ok) {
      this.sha = (await odziv.json()).content.sha;
      return vsebina;
    }

    // 409/422 = naš sha je zastarel: nekdo je pisal vmes
    if ((odziv.status === 409 || odziv.status === 422) && poskus < 3) {
      const { podatki } = await this.prenesi();
      const zlito = sestavi(podatki);
      return this.zapisi(() => zlito, sporocilo, poskus + 1);
    }

    if (odziv.status === 401) throw new Error('Žeton ni veljaven ali je potekel.');
    if (odziv.status === 403) throw new Error('Žeton nima pravice pisanja v ta repozitorij.');
    throw new Error('Zapis ni uspel (koda ' + odziv.status + ').');
  },
};
