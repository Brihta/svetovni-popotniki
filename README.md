# Svetovni popotniki — kviz zastav

Spletna stran za učenje zastav v slovenščini. Nastala je za RAP **Svetovni popotniki**
na OŠ Šempeter v Savinjski dolini. Deluje brez povezave (PWA), vse je v brskalniku,
zaledja ni.

## Potek ure

1. Na **Pripravi** izberi 6 zastav — ročno iz spustnega menija ali z gumbom
   **Naključnih 6 zastav**. Filter po celini in *Ne ponavljaj že vprašanih*
   poskrbita, da se izbor ne vrti v krogu.
2. **Začni kviz** — zastave se pokažejo čez cel zaslon, imena so skrita.
3. Zaženi **2:00** in učenci pišejo na mini tablice.
4. **Razkrij 1 ▸** odpre prvo zastavo: veliko sliko, slovensko ime in seznam
   učencev. Klikni tiste, ki so uganili. Ponovni klik točko vzame nazaj.
5. **Naprej ▸** do konca, nato **Lestvica**.

Tipkovnica med kvizom: `preslednica` časovnik, `1`–`6` skok na zastavo,
`Enter` naprej, `Esc` zapri.

## Datoteke

| | |
|---|---|
| `zastave.html` | stran; `index.html` samo preusmeri nanjo |
| `css/zastave.css` | videz |
| `js/zastave.js` | logika kviza, točkovanje, sinhronizacija |
| `js/drzave.js` | 200 držav — koda zastave, slovensko in angleško ime, celina |
| `js/oblak.js` | shramba na GitHubu — branje, zapis, zlivanje |
| `assets/zastave/` | 200 zastav v SVG |
| `popotniki.json` | zasilni seznam skupin — **ni v repozitoriju** |

Seznam držav je povzet po Twinklovih karticah *Countries of the World with Flags*,
imena so prevedena v slovenščino. Zastave so iz zbirke
[flag-icons](https://github.com/lipis/flag-icons) (javna last); kurdistanska je
narisana posebej, ker je v zbirki ni.

## Učenci in točke

Skupini sta dve, ker je bila celotna skupina prevelika za eno uro:

- **A** — 3. in 5. razred
- **B** — 4. razred

Ker ure tečejo v različnih učilnicah, točke ne smejo živeti v enem brskalniku.
Zato so **seznam učencev in vse točke v ločenem zasebnem repozitoriju**, v
datoteki `podatki.json`. Brskalnik ima samo delovno kopijo.

### Enkratna nastavitev

1. Na GitHubu naredi nov **zaseben** repozitorij, npr. `nicki89-blip/popotniki-tocke`.
   Prazen je čisto v redu — datoteko ustvari aplikacija sama.
   Naredi ga **pod svojim računom, ne pod organizacijo `Brihta`** — pri organizaciji
   mora žeton posebej odobriti še organizacija sama.
2. Naredi *fine-grained* žeton: **Settings → Developer settings → Personal access
   tokens → Fine-grained tokens → Generate new token**.
   - *Repository access*: **Only select repositories** → izberi `popotniki-tocke` (pod svojim računom, ne pod organizacijo)
   - *Permissions → Repository permissions → Contents*: **Read and write**
   - *Expiration*: koliko časa hočeš; ko poteče, ga je treba obnoviti
3. V kvizu odpri **Nastavitve → Shramba na GitHubu**, vpiši `nicki89-blip/popotniki-tocke`
   in žeton, pritisni **Poveži**.

Korak 3 ponoviš na vsakem računalniku, ki ga uporabljaš. Žeton ostane na tistem
računalniku in ne gre nikoli v noben repozitorij.

### Če žeton po zaprtju brskalnika izgine

Chrome ima nastavitev *Delete data sites have saved to your device when you close
all windows*. Če je vklopljena, se ob zaprtju pobriše tudi žeton — in z njim
delovna kopija točk, ki morda še ni prišla na GitHub.

Odpri `chrome://settings/content/siteData` in pod **Allowed to save data on your
device → Add** dodaj `https://brihta.github.io`. Privzetega vedenja za ostale
strani ni treba spreminjati.

> Na tujem ali skupnem računalniku odkljukaj *Zapomni si žeton na tem računalniku* —
> takrat žeton velja samo do zaprtja brskalnika.

### Kako se podatki usklajujejo

Edini zapis, ki šteje, je **krog**: ena razkrita zastava z imeni tistih, ki so jo
uganili. Točke in „že videne zastave" sta izpeljanki. To ni malenkost — vsak krog
ima svoj `id`, zato se delo z dveh računalnikov **zlije brez konfliktov**.
Če bi shranjeval seštevke, bi se ob istočasnem delu izgubili.

Če se nekdo drug dotakne iste zastave, obvelja novejša sprememba. Če GitHub zapis
zavrne, ker je vmes pisal drug računalnik, aplikacija znova prebere, zlije in
poskusi še enkrat.

**Brez povezave ura ne stoji.** Točke gredo v brskalnik, značka v glavi pokaže
*Nesinhronizirano*, in takoj ko je wi-fi spet tu, gre vse na GitHub — samodejno,
tudi če zapis prej ni uspel. Značka je zato v glavi in ne skrita v nastavitvah.

Poleg tega lahko kadar koli shraniš kopijo v datoteko (**Nastavitve → Varnostna
kopija**). Nalaganje kopije zapise *zlije*, ne prepiše.

`popotniki.json` v tej mapi je samo zasilni vir za prvo povezavo in za delo brez
GitHuba; je v `.gitignore` in ne gre v repozitorij.

## Zagon lokalno

Service worker potrebuje `http://`, ne `file://`:

```bash
npx serve -l 3456 .
```

Nato odpri `http://localhost:3456/zastave.html`.
