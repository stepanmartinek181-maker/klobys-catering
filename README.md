# Klobys — catering, jídelna a vývařovna

Klientský náhled webu: https://stepanmartinek181-maker.github.io/klobys-catering/

Statický vícestránkový web, optimalizované fotografie ve složce `assets/`.
GitHub Pages používá větev `main` a kořenovou složku `/`.

Web představuje především catering a tým Klobys. Nabídka je rozdělená na
Catering, Jídelnu, Půjčovnu a Kafe. Každá sekce má vlastní HTML stránku,
nikoli sekci na úvodu. Samostatné stránky mají také Galerie, Kontakt a jídelní
lístky. Kontakt vrací návštěvníka na stránku, odkud přišel; ostatní nabídky
mají návrat na úvod. Rozvržení je přizpůsobené mobilům.

Stránky: `index.html`, `catering.html`, `jidelna.html`, `pujcovna.html`,
`kafe.html`, `galerie.html`, `kontakt.html` a `jidelni-listky.html`.
Původní odkazy na sekce přesměrují na odpovídající novou stránku.

Půjčovna obsahuje 54 konkrétních položek: inventář (17), mobiliář (6)
a restaurační/barové vybavení (31). Kategorie lze přepínat a položky hledat
i bez diakritiky. Spotřební doplňky jsou označené odděleně od zapůjčovaného vybavení.
Catering představuje svatby, oslavy a firemní akce a také 15 druhů občerstvení:
smažené boxy (4), slané boxy (8), kanapky (2) a saláty (1).
Kafe obsahuje Kloby’s Blend, Brazil, Columbia a Guatemala, jejich chuťové
profily, pražení a nabídku balení 500 g / 1 kg. Svíčka Kafe je samostatný doplněk.
Nabídka byla porovnána s veřejným katalogem klobys.cz 7. 10. 2026.
Použito je 57 skutečných produktových fotografií, optimalizovaných a uložených
přímo ve webu. Kde veřejný zdroj nemá fotografii, není doplněný falešný obrázek.
Návštěvník přidává položky z cateringu, půjčovny i kávy do jedné nezávazné
poptávky. Výběr se uchovává v prohlížeči; na kontaktu lze upravit množství
nebo odebrat položky. Web nemá platby ani závazné objednávky. Cenu, dostupnost,
velikost cateringové sestavy a podmínky zapůjčení potvrzuje tým osobně.
Po výběru Cateringu (15 položek), Půjčovny (54) nebo Kafe (4 kávy a 1 doplněk)
lze odpovídající nabídku hledat a přidávat i přímo v kontaktním formuláři,
bez odchodu na katalog. Hledání funguje bez diakritiky, má vlastní filtry
kategorií a výsledky zobrazuje po šesti. Výběr se sdílí s katalogem.
U „Více služeb“ jsou dostupné všechny tři nabídky; svatby, oslavy a firemní
akce zobrazují občerstvení cateringu. Svíčka Kafe zůstává oddělená od kávy.
Nový zákaznický ceník zatím nebyl dodán; web neslibuje skladové počty ani
časovou jednotku půjčovného. Na mobilu má káva větší jednosloupcové karty.

## Jídelní lístky a jejich správa

Veřejné lístky: https://stepanmartinek181-maker.github.io/klobys-catering/jidelni-listky.html

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
neodesílá ji automaticky přes server. Delší poptávku lze zkopírovat v plném
znění. Galerie odkazuje na vybrané příspěvky
Instagramu a nenačítá automaticky nové příspěvky.
