# AI Kuchařka - Pravidla pro postupy přípravy receptů

## Pravidlo pro časové údaje v postupech přípravy (instructions)
1. **Konkrétní časy u všech klíčových procesů**: V postupech přípravy (`instructions`) u všech receptů MUSÍ být u každého procesního, fyzikálního či chemického kroku (např. **klíčení, fermentace, autolýza, rozkvas, kynutí, odležení, namáčení, chlazení, odpočinek, hnětení, pečení, smažení, vaření, šlehání, redukce**) VŽDY uveden konkrétní čas a trvání (např. *"nechte autolyzovat po dobu 30 minut"*, *"kynutí 60 minut při pokojové teplotě"*, *"odležet v chladničce 4 hodiny"*, *"pečení 45 minut při 200 °C"*, *"hněťte po dobu 10 minut"*).
2. **Žádné váhové údaje v postupech**: V krocích postupu neopakujte gramy, mililitry ani kusy surovin (ty patří výhradně do pole `ingredients`), ale **časové údaje a trvání operací jsou povinné u každého procesního kroku**.
3. **Platnost**: Toto pravidlo platí pro všechny stávající recepty v aplikaci (`defaultRecipes.ts` i `data/recipes/*.json`) a stejně tak pro jakékoliv nové nebo upravované recepty vygenerované pomocí Gemini AI.
