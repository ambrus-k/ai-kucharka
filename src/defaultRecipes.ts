import { Recipe } from "./types";

export const DEFAULT_RECIPES: Recipe[] = [
  {
    id: "svickova",
    title: "Svíčková na smetaně",
    summary: "Tradiční svíčková na smetaně zjemněná karamelizací zeleniny v multifunkčním hrnci.",
    cookingTime: "90 min",
    difficulty: "Složité",
    applianceType: "Multifunkční hrnec",
    ingredients: [
      "800g hovězí zadní (váleček nebo loupaná plec)",
      "50g špeku (nakrájeného na klínky na špikováni)",
      "200g mrkve (očištěné a nastrouhané)",
      "150g celeru (očištěného a nastrouhaného)",
      "100g petržele (očištěné a nastrouhané)",
      "1 velká cibule (nadrobno nakrájená)",
      "2 lžíce plnotučné hořčice",
      "2 lžíce octa",
      "3 lžíce cukru krupice",
      "5 ks kuliček nového koření",
      "10 ks kuliček černého pepře",
      "4 ks bobkových listů",
      "500ml hovězího vývaru",
      "250ml smetany ke šlehání (33% tuku)",
      "50g másla",
      "Sůl a čerstvě mletý pepř",
      "Citrónová šťáva na dochucení"
    ],
    instructions: [
      "Hovězí maso prošpikujte vychlazeným špekem, osolte a opepřete ze všech stran.",
      "V multifunkčním hrnci (program Smažení/Saute) rozpusťte kousek másla a maso ze všech stran zprudka zatáhněte. Poté ho vyjměte.",
      "Do výpěku přidejte nastrouhanou kořenovou zeleninu. Smažte ji do sytě zlatohnědé barvy (karamelizace cukrů v zelenině trvá asi 10 minut).",
      "Přidejte cibuli, krátce osmahněte, přisypte cukr a nechte ho lehce zkaramelizovat. Zapracujte hořčici a zalijte octem – nechte zcela odpařit.",
      "Vložte zpět maso, přidejte koření (nejlépe v čajovém sítku pro snadné vyjmutí) a zalijte teplým vývarem tak, aby sahal do poloviny masa.",
      "Hrnec uzavřete a zapněte program Tlakové vaření (High Pressure) na 45 minut. Po skončení nechte tlak přirozeně klesnout (15-20 min).",
      "Vyjměte maso a koření. Obsah hrnce přelijte do mixéru nebo přímo v hrnci rozmixujte tyčovým mixérem do hladka.",
      "Přilijte smetanu, přidejte studené máslo na zjemnění a nechte krátce provařit bez pokličky na mírný stupeň.",
      "Ochuťte solí, pepřem a citrónovou šťávou. Maso nakrájejte na plátky a podávejte s omáčkou a houskovým knedlíkem."
    ],
    applianceTips: "Při vaření v multifunkčním nebo tlakovém hrnci nedochází k odpařování tekutiny jako v klasickém rendlíku. Proto nepoužívejte zbytečně mnoho vývaru – zelenina s masem pustí vlastní šťávu, což zesílí chuť omáčke bez nutnosti zahušťování moukou.",
    expertJustification: "Svíčková podle food science: Reakce zeleniny s cukrem spouští Maillardovu reakci, která dodává omáčce hlubokou sladkost. Rychlé zchlazení másla na závěr emulguje tuk s tekutinou, což vytvoří sametovou texturu bez jakékoli mouky. Zatažení masa zabrání nadměrnému úniku šťávy během tlakového vaření.",
    category: "Maso",
    isDefault: true
  },
  {
    id: "bucek",
    title: "Pečený bůček",
    summary: "Šťavnatý vepřový bůček s křupavou kůrkou.",
    cookingTime: "55 min",
    difficulty: "Střední",
    applianceType: "Horkovzdušná fritéza",
    ingredients: [
      "1kg vepřového bůčku (s kůží, bez kosti)",
      "2 lžičky hrubozrnné soli",
      "1 lžička drceného kmínu",
      "4 stroužky česneku (utřené)",
      "1 lžíce jablečného octa",
      "1 lžička kukuřičného škrobu"
    ],
    instructions: [
      "Kůži bůčku ostrým nožem nakrájejte do mřížky (řežte pouze do tuku, ne do masa).",
      "Do masa ze spodní a bočních stran vetřete utřený česnek, kmín a sůl. Kůži nechte čistou.",
      "Osušte kůži papírovou utěrkou, potřete jablečným octem a rovnoměrně posypejte tenkou vrstvou soli smíchané s kukuřičným škrobem.",
      "Vložte bůček do koše fritézy kůží dolů a pečte na 160 °C po dobu 35 minut, aby se maso prohřálo a tuk začal pomalu odtékat.",
      "Opatrně bůček otočte kůží nahoru. Zvyšte teplotu na 200 °C a pečte dalších 15 až 20 minut, dokud kůže nevytvoří puchýřky a nebude extrémně křupavá.",
      "Před krájením nechte bůček 10 minut odpočinout na prkénku, aby se šťávy uvnitř stabilizovaly."
    ],
    applianceTips: "V horkovzdušné fritéze cirkuluje vzduch velmi rychle. Kukuřičný škrob a ocet na kůži vytáhnou přebytečnou vlhkost z povrchových buněk, což zaručí bleskové vytvoření křupavé krusty bez vysušení celého kusu masa.",
    expertJustification: "Podle fyziky tepla: Dvoufázová metoda kombinuje pomalou želatinizaci kolagenu (při 160 °C, kdy maso změkne a pustí tuk) s bleskovou dehydratací kůže při vysoké teplotě (200 °C), která prudce expanduje vzduchové kapsy v kůži.",
    category: "Maso",
    isDefault: true
  },
  {
    id: "chleb",
    title: "Domácí chléb",
    summary: "Pšenično-žitný chléb s optimálním kynutím.",
    cookingTime: "180 min",
    difficulty: "Snadné",
    applianceType: "Domácí pekárna",
    ingredients: [
      "330ml vlažné vody",
      "1.5 lžíce olivového oleje",
      "1.5 lžičky soli",
      "1 lžička cukru",
      "350g hladké pšeničné chlebové mouky",
      "150g žitné chlebové mouky",
      "1.5 lžičky drceného kmínu",
      "1.25 lžičky sušeného droždí"
    ],
    instructions: [
      "Do nádoby domácí pekárny nalijte nejprve tekuté suroviny: vlažnou vodu a olivový olej.",
      "Přidejte sůl a cukr do protilehlých rohů nádoby.",
      "Zasypte oběma druhy mouky tak, aby zcela zakryly vodní hladinu.",
      "Uprostřed mouky vytvořte malý důlek (nesmí dosáhnout k vodě) and nasypte do něj sušené droždí. Do rohů přidejte kmín.",
      "Vložte nádobu do pekárny, zvolte program 'Základní' (Basic/French), velikost bochníku 750g-1000g, a barvu kůrky 'Tmavá'.",
      "Spusťte program. Na začátku hnětení doporučujeme po 5 minutách vizuálně zkontrolovat těsto – mělo by tvořit hladkou nelepivou kouli. Pokud je moc tekuté, přidejte lžíci mouky.",
      "Po upečení chléb ihned opatrně vyjměte z pekárny i z formy a nechte zcela vychladnout na mřížce (alespoň 1 hodinu), aby se střídka nesrazila."
    ],
    applianceTips: "Po skončení hnětení a před spuštěním fáze pečení je skvělé rychle otevřít víko, čistýma mokrýma rukama vyjmout hnětací háky a těsto urovnat. Chléb pak nebude mít vespod velké díry po hácích.",
    expertJustification: "Vědecký pohled na kvašení: Přesné pořadí ingrediencí brání předčasné aktivaci kvasinek solí (sůl je osmoticky aktivní a kvasinky by dehydratovala). Žitná mouka dodává chlebu amylázu, která štěpí škroby na jednoduché cukry, což dává střídce pružnost a prodlužuje čerstvost.",
    category: "Pečivo",
    isDefault: true
  },
  {
    id: "knedliky",
    title: "Borůvkové knedlíky",
    summary: "Nadýchané kynuté knedlíky vařené v páře.",
    cookingTime: "40 min",
    difficulty: "Střední",
    applianceType: "Thermomix / Kuchyňský robot",
    ingredients: [
      "250g polohrubé mouky",
      "120ml polotučného mléka (vlažného)",
      "15g čerstvého droždí",
      "1 lžíce cukru krupice",
      "1 žloutek",
      "Špetka soli",
      "250g čerstvých borůvek",
      "K rozpuštění: 100g másla",
      "K podávání: strouhaný tvaroh, moučkový cukr"
    ],
    instructions: [
      "Do nádoby robota nalijte vlažné mléko, přidejte cukr a nadrobte kvasnice. Nechte 5-10 minut v teple vzejít kvásek.",
      "Přidejte žloutek, špetku soli a polohrubou mouku. Zapněte program pro hnětení těsta (Dough program / klasické hnětení) po dobu 3 minut.",
      "Těsto vyjměte z nádoby, vložte do mísy, poprašte moukou, přikryjte utěrkou a nechte na teplém místě 30 minut kynout.",
      "Vykynuté těsto rozdělte na 8 stejných dílů. Každý díl zploštěte dlaní, do středu dejte polévkovou lžíci borůvek a pečlivě zabalte do kuličky.",
      "Nechte ještě 10 minut dokynout na pomoučeném vále.",
      "Do nádoby robota nalijte 500ml vody. Parní koš (Varoma/parní nástavec) vymažte olejem a naskládejte knedlíky s rozestupy (vařením nabydou).",
      "Spusťte parní vaření (Steam/Varoma) na 16-18 minut.",
      "Po dovaření knedlíky ihned vyjměte a propíchněte vidličkou, aby z nich odešla pára a nesrazily se. Podávejte polité máslem a posypané tvarohem a cukrem."
    ],
    applianceTips: "Parní koš kuchyňského robota udržuje konstantní, nepřerušovaný proud páry o stabilní teplotě 100 °C. To brání prudkým změnám teplot, které v klasickém hrnci na plotně způsobují sražení těsta.",
    expertJustification: "Fyzika těsta: Propíchnutí knedlíků těsně po vytažení z páry uvolní přetlak nahromaděné vodní páry uvnitř střídky. Pokud by pára zůstala uvnitř, při ochlazování by kondenzovala zpět na vodu, čímž by stlačila vzduchové póry a vytvořila tuhé, sražené těsto.",
    category: "Sladká jídla a moučníky",
    isDefault: true
  }
];
