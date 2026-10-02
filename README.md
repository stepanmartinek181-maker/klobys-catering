# Klobys — catering, jídelna a vývařovna

Klientský náhled webu: https://stepanmartinek181-maker.github.io/klobys-catering/

Statický web v souboru `index.html`, optimalizované fotografie ve složce `assets/`.
GitHub Pages používá větev `main` a kořenovou složku `/`.

Web představuje catering a tým Klobys. Nabídka je rozdělená na Jídelnu,
Catering, Půjčovnu a Kafe. Kontakt i jídelní lístky mají vlastní pohled
s možností návratu na hlavní stránku. Rozvržení je přizpůsobené mobilům.

## Jídelní lístky a jejich správa

Veřejné lístky: https://stepanmartinek181-maker.github.io/klobys-catering/#jidelni-listky

Správa: https://stepanmartinek181-maker.github.io/klobys-catering/sprava-jidelni-listky.html

Správce se přihlásí svým GitHub účtem a přes odkaz „Přidat jídelní lístek“
vyplní formulář: název, platnost od/do, typ nabídky, jídla a případně PDF
nebo fotku. Po uložení GitHub Actions vytvoří veřejné `menus.json`
a požádá o nové nasazení GitHub Pages. Změny mohou trvat několik minut.

Pro úpravu změňte popis existujícího Issue a zachovejte názvy polí.
Uzavřením Issue se lístek skryje; opětovným otevřením se vrátí.
Chybně vyplněné lístky jsou uvedené ve správě v části „Lístky k opravě“.
Návštěvníci nemusejí mít účet. Skutečná nabídka se zobrazuje podle platnosti
v časovém pásmu Europe/Prague; ukázky jsou vždy jasně označené.
Dosud nebylo dodáno aktuální menu. Ilustrační nabídka není skutečné dnešní menu
ani závazný ceník.

Publikovat nyní může pouze majitel repozitáře (ID 238918077).
Zákazníkův účet musí být po jeho schválení doplněn současně do
`.github/menu-editors.json` a podmínky workflow. Žádné heslo ani osobní
přístupový token není součástí webu. Místní server a jeho pracovní data
nejsou součástí tohoto repozitáře.

Před další ruční aktualizací webu stáhněte aktuální `main` a zachovejte
živé `menus.json` i `menus-status.json`; nepřepisujte je prázdnou kopií.
Testy parseru: `node --test .github/scripts/menu-parser.test.mjs`.

Kontaktní formulář připraví poptávku v e-mailovém programu návštěvníka;
neodesílá ji automaticky přes server. Galerie odkazuje na vybrané příspěvky
Instagramu a nenačítá automaticky nové příspěvky.
