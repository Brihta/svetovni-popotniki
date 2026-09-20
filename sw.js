/* =====================================================================
   Svetovni popotniki — kviz zastav
   Aplikacija mora delovati brez povezave: v učilnici wi-fi ni vedno zanesljiv.
   ===================================================================== */
const CACHE = 'popotniki-v2';

/** Lupina aplikacije — brez tega ne gre nič. */
const ASSETS = [
  './',
  './zastave.html',
  './manifest.json',
  './icon.svg',
  './assets/logo-os-sempeter.png',
  './css/zastave.css',
  './js/drzave.js',
  './js/oblak.js',
  './js/zastave.js',
];

/** 200 zastav — po eno, da ena manjkajoča ne podre namestitve. */
const ZASTAVE = [
  './assets/zastave/ad.svg',
  './assets/zastave/ae.svg',
  './assets/zastave/af.svg',
  './assets/zastave/ag.svg',
  './assets/zastave/al.svg',
  './assets/zastave/am.svg',
  './assets/zastave/ao.svg',
  './assets/zastave/ar.svg',
  './assets/zastave/at.svg',
  './assets/zastave/au.svg',
  './assets/zastave/aw.svg',
  './assets/zastave/az.svg',
  './assets/zastave/ba.svg',
  './assets/zastave/bb.svg',
  './assets/zastave/bd.svg',
  './assets/zastave/be.svg',
  './assets/zastave/bf.svg',
  './assets/zastave/bg.svg',
  './assets/zastave/bh.svg',
  './assets/zastave/bi.svg',
  './assets/zastave/bj.svg',
  './assets/zastave/bn.svg',
  './assets/zastave/bo.svg',
  './assets/zastave/br.svg',
  './assets/zastave/bs.svg',
  './assets/zastave/bt.svg',
  './assets/zastave/bw.svg',
  './assets/zastave/by.svg',
  './assets/zastave/bz.svg',
  './assets/zastave/ca.svg',
  './assets/zastave/cd.svg',
  './assets/zastave/cf.svg',
  './assets/zastave/ch.svg',
  './assets/zastave/ci.svg',
  './assets/zastave/ck.svg',
  './assets/zastave/cl.svg',
  './assets/zastave/cm.svg',
  './assets/zastave/cn.svg',
  './assets/zastave/co.svg',
  './assets/zastave/cr.svg',
  './assets/zastave/cu.svg',
  './assets/zastave/cy.svg',
  './assets/zastave/cz.svg',
  './assets/zastave/de.svg',
  './assets/zastave/dj.svg',
  './assets/zastave/dk.svg',
  './assets/zastave/dm.svg',
  './assets/zastave/do.svg',
  './assets/zastave/dz.svg',
  './assets/zastave/ec.svg',
  './assets/zastave/ee.svg',
  './assets/zastave/eg.svg',
  './assets/zastave/es.svg',
  './assets/zastave/et.svg',
  './assets/zastave/fi.svg',
  './assets/zastave/fj.svg',
  './assets/zastave/fm.svg',
  './assets/zastave/fr.svg',
  './assets/zastave/ga.svg',
  './assets/zastave/gb-eng.svg',
  './assets/zastave/gb-nir.svg',
  './assets/zastave/gb-sct.svg',
  './assets/zastave/gb-wls.svg',
  './assets/zastave/gb.svg',
  './assets/zastave/gd.svg',
  './assets/zastave/ge.svg',
  './assets/zastave/gg.svg',
  './assets/zastave/gh.svg',
  './assets/zastave/gm.svg',
  './assets/zastave/gn.svg',
  './assets/zastave/gq.svg',
  './assets/zastave/gr.svg',
  './assets/zastave/gt.svg',
  './assets/zastave/gy.svg',
  './assets/zastave/hn.svg',
  './assets/zastave/hr.svg',
  './assets/zastave/ht.svg',
  './assets/zastave/hu.svg',
  './assets/zastave/ic.svg',
  './assets/zastave/id.svg',
  './assets/zastave/ie.svg',
  './assets/zastave/il.svg',
  './assets/zastave/in.svg',
  './assets/zastave/iq.svg',
  './assets/zastave/ir.svg',
  './assets/zastave/is.svg',
  './assets/zastave/it.svg',
  './assets/zastave/jm.svg',
  './assets/zastave/jo.svg',
  './assets/zastave/jp.svg',
  './assets/zastave/ke.svg',
  './assets/zastave/kg.svg',
  './assets/zastave/kh.svg',
  './assets/zastave/ki.svg',
  './assets/zastave/km.svg',
  './assets/zastave/kn.svg',
  './assets/zastave/kp.svg',
  './assets/zastave/kr.svg',
  './assets/zastave/kurd.svg',
  './assets/zastave/kw.svg',
  './assets/zastave/kz.svg',
  './assets/zastave/la.svg',
  './assets/zastave/lb.svg',
  './assets/zastave/lc.svg',
  './assets/zastave/li.svg',
  './assets/zastave/lk.svg',
  './assets/zastave/lr.svg',
  './assets/zastave/ls.svg',
  './assets/zastave/lt.svg',
  './assets/zastave/lu.svg',
  './assets/zastave/lv.svg',
  './assets/zastave/ly.svg',
  './assets/zastave/ma.svg',
  './assets/zastave/mc.svg',
  './assets/zastave/md.svg',
  './assets/zastave/me.svg',
  './assets/zastave/mg.svg',
  './assets/zastave/mh.svg',
  './assets/zastave/mk.svg',
  './assets/zastave/ml.svg',
  './assets/zastave/mm.svg',
  './assets/zastave/mn.svg',
  './assets/zastave/mt.svg',
  './assets/zastave/mu.svg',
  './assets/zastave/mv.svg',
  './assets/zastave/mw.svg',
  './assets/zastave/mx.svg',
  './assets/zastave/my.svg',
  './assets/zastave/mz.svg',
  './assets/zastave/na.svg',
  './assets/zastave/ne.svg',
  './assets/zastave/ng.svg',
  './assets/zastave/ni.svg',
  './assets/zastave/nl.svg',
  './assets/zastave/no.svg',
  './assets/zastave/np.svg',
  './assets/zastave/nr.svg',
  './assets/zastave/nu.svg',
  './assets/zastave/nz.svg',
  './assets/zastave/om.svg',
  './assets/zastave/pa.svg',
  './assets/zastave/pe.svg',
  './assets/zastave/pg.svg',
  './assets/zastave/ph.svg',
  './assets/zastave/pk.svg',
  './assets/zastave/pl.svg',
  './assets/zastave/pr.svg',
  './assets/zastave/ps.svg',
  './assets/zastave/pt.svg',
  './assets/zastave/pw.svg',
  './assets/zastave/py.svg',
  './assets/zastave/qa.svg',
  './assets/zastave/ro.svg',
  './assets/zastave/rs.svg',
  './assets/zastave/ru.svg',
  './assets/zastave/rw.svg',
  './assets/zastave/sa.svg',
  './assets/zastave/sb.svg',
  './assets/zastave/sc.svg',
  './assets/zastave/se.svg',
  './assets/zastave/sg.svg',
  './assets/zastave/si.svg',
  './assets/zastave/sk.svg',
  './assets/zastave/sl.svg',
  './assets/zastave/sm.svg',
  './assets/zastave/sn.svg',
  './assets/zastave/so.svg',
  './assets/zastave/sr.svg',
  './assets/zastave/ss.svg',
  './assets/zastave/st.svg',
  './assets/zastave/sv.svg',
  './assets/zastave/sy.svg',
  './assets/zastave/sz.svg',
  './assets/zastave/tg.svg',
  './assets/zastave/th.svg',
  './assets/zastave/tj.svg',
  './assets/zastave/tl.svg',
  './assets/zastave/tm.svg',
  './assets/zastave/tn.svg',
  './assets/zastave/to.svg',
  './assets/zastave/tr.svg',
  './assets/zastave/tt.svg',
  './assets/zastave/tv.svg',
  './assets/zastave/tz.svg',
  './assets/zastave/ua.svg',
  './assets/zastave/ug.svg',
  './assets/zastave/us.svg',
  './assets/zastave/uy.svg',
  './assets/zastave/uz.svg',
  './assets/zastave/va.svg',
  './assets/zastave/vc.svg',
  './assets/zastave/ve.svg',
  './assets/zastave/vn.svg',
  './assets/zastave/vu.svg',
  './assets/zastave/ws.svg',
  './assets/zastave/xk.svg',
  './assets/zastave/ye.svg',
  './assets/zastave/za.svg',
  './assets/zastave/zm.svg',
  './assets/zastave/zw.svg',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    await Promise.all(ZASTAVE.map(u => c.add(u).catch(() => {})));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  /* GitHub API se NE sme nikoli predpomniti — sicer bi brali zastarele
     točke in pisali čez tuje delo. Pustimo ga brskalniku. */
  if (url.hostname === 'api.github.com') return;

  const tuja = url.origin !== self.location.origin;

  /* Zastave, slike in pisave se ne spreminjajo — najprej predpomnilnik.
     Koda aplikacije (html/css/js/json) pa se: tam gre najprej na mrežo,
     sicer vsak popravek obvisi, dokler nekdo ne poveča CACHE. */
  const nespremenljivo = tuja || /\.(svg|png|jpg|jpeg|webp|ico|woff2?)$/i.test(url.pathname);

  e.respondWith(nespremenljivo ? najprejPredpomnilnik(e.request) : najprejMreza(e.request));
});

async function najprejPredpomnilnik(zahteva) {
  const zadetek = await caches.match(zahteva);
  if (zadetek) return zadetek;
  const odziv = await fetch(zahteva);
  if (odziv.ok) (await caches.open(CACHE)).put(zahteva, odziv.clone());
  return odziv;
}

async function najprejMreza(zahteva) {
  try {
    const odziv = await fetch(zahteva);
    if (odziv.ok) (await caches.open(CACHE)).put(zahteva, odziv.clone());
    return odziv;
  } catch (e) {
    // brez povezave: karkoli imamo shranjenega, sicer začetna stran
    return (await caches.match(zahteva)) || (await caches.match('./zastave.html')) || Response.error();
  }
}
