# OrigoMap Plus

Webbportal för att konfigurera, publicera och administrera kartor baserade på Origo Map, samt innehållssektioner (GIS-dokumentation, FAQ) och grafiska resurser. Kartor kan vara publika, utan inloggning, eller privata för behöriga användare.

## Krav

- Node.js 22 LTS eller 24 LTS. Node 25 rekommenderas inte eftersom det inte är en LTS-version.
- npm som är kompatibelt med vald Node-version.
- Nätverksåtkomst till de GIS-tjänster som kartorna använder.
- I produktion: HTTPS och en tjänsteidentitet med läs- och skrivrätt till datakatalogerna.

## Lokal installation

Från projektmappen i PowerShell:

```powershell
npm.cmd install
Copy-Item .env.example .env
```

Använd `npm.cmd` i stället för `npm` om PowerShell blockerar skript (`running scripts is disabled on this system`).

Generera en sessionshemlighet och lägg in den i `.env`:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Skapa ett första administratörskonto i `auth/users.json` före första start. Filen och dess inloggningsuppgifter distribueras inte med repot, och det finns inget standardlösenord. Lösenordet måste sparas som en bcrypt-hash. Förvara den första kopian i organisationens säkra lösenordshanterare.

Starta portalen:

```powershell
npm.cmd start
```

Öppna `http://localhost:3000`. För utveckling med automatisk omstart, använd `npm.cmd run dev`. Ändringar i `app.js` eller `routes/` kräver omstart av servern; ändringar i `views/` läses in direkt.

## Konfiguration

| Variabel | Användning |
| --- | --- |
| `PORT` | HTTP-port för Node; standard `3000`. |
| `NODE_ENV` | Använd `production` i skarp drift. |
| `SESSION_SECRET` | Obligatorisk lång, slumpmässig hemlighet. Krypterar sparade sessioner; dela den inte och byt den inte utan att planera för att aktiva sessioner blir ogiltiga. |
| `SESSION_STORE_PATH` | Beständig katalog för krypterade sessioner. Standard: `data/sessions`, relativt applikationsmappen. Ska ligga utanför all publik webbrot och bara vara skrivbar för tjänsteidentiteten. |
| `TRUST_PROXY` | `1` endast om Node tar emot trafik via en betrodd omvänd proxy som sätter `X-Forwarded-*` korrekt. |
| `CORS_ORIGIN` | Tom som standard. Om en extern klient behöver CORS, ange ett konkret ursprung, till exempel `https://maps.example.se`; använd inte `*` tillsammans med inloggningsuppgifter. |

Vanliga sessioner varar i 8 timmar. Om användaren väljer **Kom ihåg mig i 60 dagar** får webbläsaren en cookie som gäller i 60 dagar. Den lokala sessionslagringen behåller den krypterade sessionen mellan omstarter och är avsedd för en enda applikationsinstans, inte för IIS Web Garden eller flera Node-instanser.

Inloggningen tillåter högst fem misslyckade försök per IP-adress inom 15 minuter; en lyckad inloggning räknas inte. Räknaren ligger i processens minne och nollställs när Node startas om. Vid flera instanser måste den ersättas med en begränsare med delad lagring.

Varje förfrågan kontrolleras mot `auth/users.json`: om ett konto tas bort eller dess lösenord byts avslutas kontots sessioner direkt, och ändrade roller och kartbehörigheter gäller utan ny inloggning.

## Roller och åtkomst

- `admin`: administrerar användare, konfigurationer, media, sektioner och publicering; kan öppna alla publicerade kartor och se alla sektioner.
- `intern`: interna användare. Privata kartor kräver att administratören tilldelar varje karta.
- `extern`: kan öppna publika kartor och de privata kartor som tilldelats.
- Anonym besökare: ser startsidan, publicerade kartor som är markerade som publika och sektioner med synlighet "Everyone".

Publik synlighet och behörighet är separata beslut. En publik karta kan öppnas utan inloggning. En privat karta kräver inloggning och uttrycklig behörighet, utom för `admin`. Utforma kartor och deras GIS-resurser med utgångspunkten att allt innehåll i en publik karta blir åtkomligt utanför organisationen.

## Använda portalen

### Sidhuvud och sidfot

Sidhuvudet visar Origo Plus-logotypen, administrationsmenyerna (endast `admin`) och en knapp för varje innehållssektion som den aktuella användaren får se. Sidfoten visar webbplatsens logotyp, som väljs under **Admin → Media**.

### Öppna kartor

Startsidan (`/`) visar publika kartor för alla. Efter inloggning visas även de privata kartor användaren har behörighet till. Klicka på kartans bild eller titel för att öppna den. En kartas adress har formen `/OrigoMap/kartans-namn`.

Vilka verktyg som finns i kartan beror på dess Origo-konfiguration, till exempel teckenförklaring, sök, objektinformation, mätning, utskrift och lagerval. Om kartan inte laddas, kontrollera publiceringsstatus, JSON-konfigurationen och anslutningen till WMS-, WMTS-, WFS- eller andra refererade tjänster.

### Skapa och konfigurera en karta

1. Logga in som administratör och öppna **Admin Panel** (`/origoadmin/origo-admin`).
2. Under **Map Configurations**, klicka **Copy** bredvid en baskonfiguration. Använd namn med bokstäver, siffror, bindestreck eller understreck.
3. Klicka **Edit JSON** för att ändra källor, lager, grupper, stilar och kontroller. Spara med **Save Changes** och validera JSON innan publicering.
4. Kontrollera att GIS-tjänsternas URL:er går att nå från de tänkta användarnas webbläsare. Lägg aldrig lösenord eller privata nycklar i konfigurationen för en publik karta.
5. Klicka **Publish**. Publiceringen skapar kartans sida men gör den inte publik.
6. Granska kartan från startsidan och kontrollera teckenförklaring, lager, skala, sökningar och tjänstebehörigheter.

Kartan `index` är baskonfigurationen och är skyddad mot borttagning, publicering och avpublicering från tabellen. **Unpublish** tar bort kartan från listan över publicerade kartor; **Delete Map** raderar dess JSON och kan inte ångras utan säkerhetskopia.

### Göra en karta publik eller privat

I kolumnen **Map Configurations** växlar hänglåset mellan publik och privat. En privat karta visas inte för anonyma besökare och kräver behörighet även om någon känner till adressen. En publik karta visas på startsidan utan inloggning. Testa adressen i ett privat webbläsarfönster efter varje ändring.

### Administrera användare och behörigheter

Öppna `/admin/users` med ett `admin`-konto.

- **Add New User** skapar konton med namn, lösenord och roll (`intern` eller `extern`). Nya lösenord måste ha minst 12 tecken.
- **Change Password** byter kontots lösenord och loggar ut kontots aktiva sessioner.
- **Manage Maps** tilldelar eller tar bort privata kartor. Publika kartor kräver ingen tilldelning.
- **Delete** tar bort ett konto, utom användaren `admin` som skyddas av gränssnittet.

Gå igenom tilldelningarna när en person byter roll och när ett konto avslutas. Konton och hashar finns i `auth/users.json`, som är lokal konfiguration och undantagen från Git.

### Media och logotyper

**Admin → Media** (`/media`) är endast för administratörer. Filer (`svg`, `png`, `jpg`, `jpeg`) laddas upp i kategorierna **ikons**, **images** eller **logo** och sparas i `data/uploaded/media/<kategori>/`. De serveras **publikt** på `/media-files/<kategori>/<fil>` så att kartor kan använda dem; ladda därför inte upp känsligt material. Knappen **Use as Site Logo** under **logo** sätter webbplatsens logotyp (sparas i `data/site-config/site-config.json`).

### Innehållssektioner

**Admin → Sections** (`/sections`) används för att skapa, byta namn på, sortera (↑/↓) och ta bort sektioner. För varje sektion väljs vem som ser den:

- **Everyone** – alla, även utan inloggning.
- **All logged-in users** – alla inloggade.
- **Selected roles / users** – valda roller och/eller enskilda användare.

Sektionen öppnas på `/sections/<namn>`. Administratören redigerar texten med editorn och sparar; övriga användare ser texten skrivskyddad. Listan sparas i `data/sections/sections.json` och texterna i `data/sections/content/<namn>.html`. De gamla adresserna `/om/strategi`, `/om/omqgis` och `/om/omdatabas` omdirigeras till motsvarande sektion.

GIS-konfigurationer och lokala data finns i `data/`, `models/` och `auth/`; publicera aldrig de katalogerna eller filer som är undantagna från Git. För Origos konfigurationsalternativ, se den medföljande dokumentationen i `public/Thirdparty/origo-map/origo-documentation` och exemplen i samma katalog.

## Testa portalen

Kör testet efter uppdateringar. Använd ett vanligt fönster för `admin` och ett privat fönster (eller annan webbläsare) för övriga användare.

1. **Start** – kör `npm.cmd start` och öppna `http://localhost:3000`. Servern ska skriva `Server listening at http://localhost:3000` utan fel.
2. **Anonym besökare** – startsidan visar bara publika kartor och en **Login**-knapp; sidfoten visar webbplatsens logotyp. `/media`, `/sections` och `/origoadmin/origo-admin` ska skicka dig till inloggningen.
3. **Admin-inloggning** – sidhuvudet visar Origo Plus-logotypen, menyerna **Origo** och **Admin** samt sektionsknapparna.
4. **Media** – ladda upp en bild under **logo**. Miniatyren ska synas. Klicka **Use as Site Logo** och ladda om: sidfoten och startsidan visar den nya logotypen. Öppna `/media-files/logo/<fil>` i det privata fönstret – bilden ska visas. Radera en testfil och kontrollera att den försvinner.
5. **Sektioner** – skapa sektionen "Test" med **Selected roles / users** och välj en testanvändare. Öppna den, skriv text och klicka **Save**.
   - Logga in som testanvändaren: knappen "Test" syns i sidhuvud/startsida och texten är skrivskyddad.
   - Logga in som en annan användare: knappen syns inte och `/sections/test` ger "Page not found".
   - Ändra till **Everyone**: sektionen syns även utloggad. Testa ↑/↓ och **Delete**.
   - `/om/omqgis` ska omdirigera till `/sections/omqgis`.
6. **Kartor** – kopiera en karta, redigera JSON, spara, publicera. Klicka på hänglåset: som publik ska kartan synas utloggad; som privat ska `/OrigoMap/<namn>` kräva inloggning.
7. **Användare** – skapa en `extern`-användare, tilldela en privat karta med **Manage Maps** och logga in som den (kartan syns). Ta bort tilldelningen: kartan försvinner vid nästa sidladdning utan ny inloggning. Byt lösenord eller ta bort kontot: användarens session avslutas vid nästa klick.
8. **Behörighet** – som `intern`/`extern`, försök öppna `/media`, `/sections`, `/admin/users` och `/origoadmin/origo-admin`; alla ska nekas.

## Säkerhet och JSON-lagring

Portalen lagrar allt i JSON-filer (`auth/users.json`, `models/publish-state.json`, `data/sections/`, `data/site-config/`) i stället för en databas som SQLite. Det är i sig inte mindre säkert: SQLite är också bara en fil på disken och ger ingen extra behörighetskontroll. Säkerheten avgörs av filbehörigheter, att filerna ligger utanför webbroten och av applikationens kontroller.

Skydd som finns:

- Lösenord lagras som bcrypt-hashar; inloggningen har begränsning av antal försök.
- Sessioner är krypterade på disk; cookies är `httpOnly`, `sameSite=lax` och `secure` i produktion.
- Borttagna konton och bytta lösenord avslutar aktiva sessioner; roller och kartbehörigheter läses om vid varje förfrågan.
- Kartornas JSON-filer levereras bara om kartan är publicerad och användaren har behörighet.
- Fil- och kartnamn i admin- och mediafunktioner valideras så att man inte kan läsa eller skriva filer utanför avsedda kataloger.
- Media, sektioner, användare och kartadministration kräver rollen `admin`.

Begränsningar att känna till:

- **Samtidiga skrivningar**: filerna läses, ändras och skrivs utan lås. Om två administratörer sparar samtidigt kan den sista skrivningen vinna. Det är acceptabelt med få administratörer och en instans.
- **Avbrott mitt i en skrivning** (strömavbrott, krasch) kan i sällsynta fall lämna en trasig JSON-fil. Ta regelbundna säkerhetskopior av `auth/`, `models/` och `data/`.
- **En instans**: kör inte flera Node-processer mot samma filer. Behövs flera instanser, många samtidiga redaktörer eller historik, byt till SQLite/PostgreSQL och en delad sessionslagring (t.ex. Redis).
- **Betrodda administratörer**: kartbeskrivningar och sektionstexter är HTML som visas utan filtrering. Den som har `admin` kan alltså lägga in skript. Ge bara betrodda personer rollen.
- **CSRF**: det finns inga CSRF-tokens; skyddet bygger på `sameSite=lax`-cookies och JSON-anrop. Lägg inte portalen på samma domän som opålitliga webbplatser.
- **Säkerhetsrubriker** (CSP, HSTS m.m.) sätts inte av Node; konfigurera dem i IIS.
- Filer under `/media-files` är alltid publika.

## Driftsättning i IIS

1. Kör Node som lokal process och konfigurera IIS som omvänd proxy mot `http://127.0.0.1:<PORT>` med ARR och URL Rewrite.
2. Avsluta HTTPS i IIS och kontrollera att proxyn skickar `X-Forwarded-Proto` och `X-Forwarded-For` korrekt. Sätt `TRUST_PROXY=1` endast om IIS är den enda betrodda proxyn framför Node.
3. Sätt `NODE_ENV=production`, `SESSION_SECRET`, `PORT` och `SESSION_STORE_PATH` i processens eller Windows-tjänstens miljö, inte i koden eller i publika filer.
4. Ge tjänsteidentiteten skrivrätt endast till nödvändiga datakataloger (`auth/`, `models/`, `data/`, `views/Origo/`, `public/Thirdparty/origo-map/` och sessionslagringen). Håll `auth/users.json`, JSON-status, uppladdningar och kopior utanför versionshanteringen.
5. Kör en enda Node-instans så länge lokal fillagring används. För skalning, web garden eller hög tillgänglighet, flytta data och sessioner till delad lagring, till exempel en databas och Redis.
6. Konfigurera `CORS_ORIGIN` endast när det finns en konkret och betrodd cross-origin-klient.
7. Lägg till säkerhetsrubriker i IIS, till exempel `Strict-Transport-Security`, `X-Content-Type-Options: nosniff` och `Referrer-Policy`.

`service.js` installerar en Windows-tjänst och måste köras med de behörigheter Windows kräver. Tjänsten måste få variablerna ovan i sin egen miljö. `uninstall.js` tar bort tjänsten. Testa först med `npm.cmd start` och bekräfta att proxy, HTTPS, cookies och GIS-tjänster fungerar innan tjänsten installeras.

## Säkerhetskopiering och publicering

Ta med JSON-konfigurationerna, `models/publish-state.json`, `auth/users.json`, `data/site-config/site-config.json`, `data/sections/` och uppladdade filer i en behörighetsbegränsad säkerhetskopia. Lägg aldrig `node_modules` eller hemligheter i Git. Sessionslagringen kan uteslutas; om den förloras behöver användarna logga in igen.

Innan en karta publiceras, kontrollera målgrupp, tjänste-URL:er, eventuella nycklar, länkade data och behörigheterna på själva GIS-servrarna. Portalens inloggning ersätter inte behörighetskontrollen i de externa tjänsterna.

## Licenser

Projektets huvudlicens är MPL-2.0; se [LICENSE](LICENSE) och [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Granska även de enskilda komponenternas och filernas licensinformation: tredjepartsresurser kan ha andra villkor.
