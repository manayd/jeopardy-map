export type PracticeTopic = {
  slug: string;
  title: string;
  description: string;
  status: "available" | "coming-soon";
  href?: string;
  itemCount?: number;
};

export type PracticeCard = {
  prompt: string;
  answer: string;
};

export type PracticeDeckConfig = {
  slug: string;
  title: string;
  description: string;
  promptLabel: string;
  answerLabel: string;
  notes: string[];
  items: PracticeCard[];
  questionPrompt: (item: PracticeCard) => string;
  correctFeedback: (item: PracticeCard) => string;
  incorrectFeedback: (item: PracticeCard) => string;
};

function cleanCell(value: string) {
  return value.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
}

function cardsFromPairs(pairs: Array<[string, string]>): PracticeCard[] {
  return pairs.map(([prompt, answer]) => ({ prompt, answer }));
}

const WORLD_CAPITALS_RAW = `
Country	Capital City
Afghanistan	Kabul
Albania	Tirana (Tirane)
Algeria	Algiers
Andorra	Andorra la Vella
Angola	Luanda
Antigua and Barbuda	Saint John's
Argentina	Buenos Aires
Armenia	Yerevan
Australia	Canberra
Austria	Vienna
Azerbaijan	Baku
Bahamas	Nassau
Bahrain	Manama
Bangladesh	Dhaka
Barbados	Bridgetown
Belarus	Minsk
Belgium	Brussels
Belize	Belmopan
Benin	Porto Novo[1]
Bhutan	Thimphu
Bolivia	La Paz (administrative), Sucre (official)[2]
Bosnia and Herzegovina	Sarajevo
Botswana	Gaborone
Brazil	Brasilia
Brunei	Bandar Seri Begawan
Bulgaria	Sofia
Burkina Faso	Ouagadougou
Burundi	Gitega[3]
Cambodia	Phnom Penh
Cameroon	Yaounde
Canada	Ottawa
Cape Verde	Praia
Central African Republic	Bangui
Chad	N'Djamena
Chile	Santiago
China	Beijing
Colombia	Bogota
Comoros	Moroni
Congo, Democratic Republic of the	Kinshasa
Congo, Republic of the	Brazzaville
Costa Rica	San Jose
Côte d'Ivoire (Ivory Coast)	Yamoussoukro[4]
Croatia	Zagreb
Cuba	Havana
Cyprus	Nicosia
Czech Republic (Czechia)[5]	Prague
Denmark	Copenhagen
Djibouti	Djibouti
Dominica	Roseau
Dominican Republic	Santo Domingo
East Timor	Dili
Ecuador	Quito
Egypt	Cairo
El Salvador	San Salvador
England[6]	London
Equatorial Guinea	Ciudad de la Paz[7]
Eritrea	Asmara
Estonia	Tallinn
Eswatini (Swaziland)[8]	Mbabane[9]
Ethiopia	Addis Ababa
Federated States of Micronesia	Palikir
Fiji	Suva
Finland	Helsinki
France	Paris
Gabon	Libreville
Gambia	Banjul
Georgia	Tbilisi
Germany	Berlin
Ghana	Accra
Greece	Athens
Grenada	Saint George's
Guatemala	Guatemala City
Guinea	Conakry
Guinea-Bissau	Bissau
Guyana	Georgetown
Haiti	Port au Prince
Honduras	Tegucigalpa
Hungary	Budapest
Iceland	Reykjavik
India	New Delhi
Indonesia	Jakarta[10]
Iran	Tehran
Iraq	Baghdad
Ireland	Dublin
Israel	Jerusalem (very limited international recognition)[11]
Italy	Rome
Jamaica	Kingston
Japan	Tokyo
Jordan	Amman
Kazakhstan	Astana[12]
Kenya	Nairobi
Kiribati	Tarawa Atoll
Kosovo	Pristina
Kuwait	Kuwait City
Kyrgyzstan	Bishkek
Laos	Vientiane
Latvia	Riga
Lebanon	Beirut
Lesotho	Maseru
Liberia	Monrovia
Libya	Tripoli
Liechtenstein	Vaduz
Lithuania	Vilnius
Luxembourg	Luxembourg
Madagascar	Antananarivo
Malawi	Lilongwe
Malaysia	Kuala Lumpur[13]
Maldives	Male
Mali	Bamako
Malta	Valletta
Marshall Islands	Majuro
Mauritania	Nouakchott
Mauritius	Port Louis
Mexico	Mexico City
Moldova	Chisinau
Monaco	Monaco
Mongolia	Ulaanbaatar
Montenegro	Podgorica
Morocco	Rabat
Mozambique	Maputo
Myanmar (Burma)	Nay Pyi Taw[14]
Namibia	Windhoek
Nauru	No official capital
Nepal	Kathmandu
Netherlands	Amsterdam[15]
New Zealand	Wellington
Nicaragua	Managua
Niger	Niamey
Nigeria	Abuja
North Korea	Pyongyang
North Macedonia (Macedonia)[16]	Skopje
Northern Ireland[17]	Belfast
Norway	Oslo
Oman	Muscat
Pakistan	Islamabad
Palau	Ngerulmud
Palestine[18]	Jerusalem (very limited international recognition)[19]
Panama	Panama City
Papua New Guinea	Port Moresby
Paraguay	Asuncion
Peru	Lima
Philippines	Manila
Poland	Warsaw
Portugal	Lisbon
Qatar	Doha
Romania	Bucharest
Russia	Moscow
Rwanda	Kigali
Saint Kitts and Nevis	Basseterre
Saint Lucia	Castries
Saint Vincent and the Grenadines	Kingstown
Samoa	Apia
San Marino	San Marino
Sao Tome and Principe	Sao Tome
Saudi Arabia	Riyadh
Scotland[20]	Edinburgh
Senegal	Dakar
Serbia	Belgrade
Seychelles	Victoria
Sierra Leone	Freetown
Singapore	Singapore
Slovakia	Bratislava
Slovenia	Ljubljana
Solomon Islands	Honiara
Somalia	Mogadishu
South Africa	Pretoria, Bloemfontein, Cape Town[21]
South Korea	Seoul
South Sudan	Juba
Spain	Madrid
Sri Lanka	Sri Jayawardenapura Kotte[22]
Sudan	Khartoum
Suriname	Paramaribo
Sweden	Stockholm
Switzerland	Bern
Syria	Damascus
Taiwan[23]	Taipei
Tajikistan	Dushanbe
Tanzania	Dodoma[24]
Thailand	Bangkok
Togo	Lome
Tonga	Nuku'alofa
Trinidad and Tobago	Port of Spain
Tunisia	Tunis
Türkiye (Turkey)[25]	Ankara
Turkmenistan	Ashgabat
Tuvalu	Funafuti[26]
Uganda	Kampala
Ukraine	Kyiv or Kiev
United Arab Emirates	Abu Dhabi
United Kingdom	London
United States	Washington D.C.
Uruguay	Montevideo
Uzbekistan	Tashkent
Vanuatu	Port Vila
Vatican City	Vatican City
Venezuela	Caracas
Vietnam	Hanoi
Wales[27]	Cardiff
Yemen	Sana'a[28]
Zambia	Lusaka
Zimbabwe	Harare
`;

export const worldCapitals = WORLD_CAPITALS_RAW.trim()
  .split("\n")
  .slice(1)
  .map((row) => {
    const [country, capital] = row.split("\t");
    return {
      prompt: cleanCell(country),
      answer: cleanCell(capital),
    };
  });

export const usStateCapitals = cardsFromPairs([
  ["Alabama", "Montgomery"],
  ["Alaska", "Juneau"],
  ["Arizona", "Phoenix"],
  ["Arkansas", "Little Rock"],
  ["California", "Sacramento"],
  ["Colorado", "Denver"],
  ["Connecticut", "Hartford"],
  ["Delaware", "Dover"],
  ["Florida", "Tallahassee"],
  ["Georgia", "Atlanta"],
  ["Hawaii", "Honolulu"],
  ["Idaho", "Boise"],
  ["Illinois", "Springfield"],
  ["Indiana", "Indianapolis"],
  ["Iowa", "Des Moines"],
  ["Kansas", "Topeka"],
  ["Kentucky", "Frankfort"],
  ["Louisiana", "Baton Rouge"],
  ["Maine", "Augusta"],
  ["Maryland", "Annapolis"],
  ["Massachusetts", "Boston"],
  ["Michigan", "Lansing"],
  ["Minnesota", "Saint Paul"],
  ["Mississippi", "Jackson"],
  ["Missouri", "Jefferson City"],
  ["Montana", "Helena"],
  ["Nebraska", "Lincoln"],
  ["Nevada", "Carson City"],
  ["New Hampshire", "Concord"],
  ["New Jersey", "Trenton"],
  ["New Mexico", "Santa Fe"],
  ["New York", "Albany"],
  ["North Carolina", "Raleigh"],
  ["North Dakota", "Bismarck"],
  ["Ohio", "Columbus"],
  ["Oklahoma", "Oklahoma City"],
  ["Oregon", "Salem"],
  ["Pennsylvania", "Harrisburg"],
  ["Rhode Island", "Providence"],
  ["South Carolina", "Columbia"],
  ["South Dakota", "Pierre"],
  ["Tennessee", "Nashville"],
  ["Texas", "Austin"],
  ["Utah", "Salt Lake City"],
  ["Vermont", "Montpelier"],
  ["Virginia", "Richmond"],
  ["Washington", "Olympia"],
  ["West Virginia", "Charleston"],
  ["Wisconsin", "Madison"],
  ["Wyoming", "Cheyenne"],
]);

export const canadianProvincesAndTerritories = cardsFromPairs([
  ["Alberta", "Edmonton"],
  ["British Columbia", "Victoria"],
  ["Manitoba", "Winnipeg"],
  ["New Brunswick", "Fredericton"],
  ["Newfoundland and Labrador", "Saint John's"],
  ["Nova Scotia", "Halifax"],
  ["Ontario", "Toronto"],
  ["Prince Edward Island", "Charlottetown"],
  ["Quebec", "Quebec City"],
  ["Saskatchewan", "Regina"],
  ["Northwest Territories", "Yellowknife"],
  ["Nunavut", "Iqaluit"],
  ["Yukon", "Whitehorse"],
]);

export const americanPresidentsAndYears = cardsFromPairs([
  ["George Washington", "1789-1797"],
  ["John Adams", "1797-1801"],
  ["Thomas Jefferson", "1801-1809"],
  ["James Madison", "1809-1817"],
  ["James Monroe", "1817-1825"],
  ["John Quincy Adams", "1825-1829"],
  ["Andrew Jackson", "1829-1837"],
  ["Martin Van Buren", "1837-1841"],
  ["William Henry Harrison", "1841"],
  ["John Tyler", "1841-1845"],
  ["James K. Polk", "1845-1849"],
  ["Zachary Taylor", "1849-1850"],
  ["Millard Fillmore", "1850-1853"],
  ["Franklin Pierce", "1853-1857"],
  ["James Buchanan", "1857-1861"],
  ["Abraham Lincoln", "1861-1865"],
  ["Andrew Johnson", "1865-1869"],
  ["Ulysses S. Grant", "1869-1877"],
  ["Rutherford B. Hayes", "1877-1881"],
  ["James A. Garfield", "1881"],
  ["Chester A. Arthur", "1881-1885"],
  ["Grover Cleveland", "1885-1889"],
  ["Benjamin Harrison", "1889-1893"],
  ["Grover Cleveland (2nd term)", "1893-1897"],
  ["William McKinley", "1897-1901"],
  ["Theodore Roosevelt", "1901-1909"],
  ["William Howard Taft", "1909-1913"],
  ["Woodrow Wilson", "1913-1921"],
  ["Warren G. Harding", "1921-1923"],
  ["Calvin Coolidge", "1923-1929"],
  ["Herbert Hoover", "1929-1933"],
  ["Franklin D. Roosevelt", "1933-1945"],
  ["Harry S. Truman", "1945-1953"],
  ["Dwight D. Eisenhower", "1953-1961"],
  ["John F. Kennedy", "1961-1963"],
  ["Lyndon B. Johnson", "1963-1969"],
  ["Richard Nixon", "1969-1974"],
  ["Gerald Ford", "1974-1977"],
  ["Jimmy Carter", "1977-1981"],
  ["Ronald Reagan", "1981-1989"],
  ["George H. W. Bush", "1989-1993"],
  ["Bill Clinton", "1993-2001"],
  ["George W. Bush", "2001-2009"],
  ["Barack Obama", "2009-2017"],
  ["Donald Trump", "2017-2021"],
  ["Joe Biden", "2021-2025"],
  ["Donald Trump (2nd term)", "2025-present"],
]);

export const historicBattles = cardsFromPairs([
  ["Battle of Marathon", "490 BCE"],
  ["Battle of Cannae", "216 BCE"],
  ["Battle of Tours", "732"],
  ["Battle of Hastings", "1066"],
  ["Siege of Orleans", "1429"],
  ["Battle of Lepanto", "1571"],
  ["Battle of Yorktown", "1781"],
  ["Battle of Trafalgar", "1805"],
  ["Battle of Waterloo", "1815"],
  ["Battle of Antietam", "1862"],
  ["Battle of Gettysburg", "1863"],
  ["Battle of Little Bighorn", "1876"],
  ["Battle of Tsushima", "1905"],
  ["Gallipoli Campaign", "1915-1916"],
  ["Battle of the Somme", "1916"],
  ["Battle of Midway", "1942"],
  ["Battle of Kursk", "1943"],
  ["Battle of Normandy", "1944"],
  ["Battle of Dien Bien Phu", "1954"],
  ["Battle of Ia Drang", "1965"],
  ["Battle of 73 Easting", "1991"],
]);

export const shakespearePlays = cardsFromPairs([
  ["Danish prince who famously asks 'To be or not to be'", "Hamlet"],
  ["Moorish general destroyed by Iago's manipulation", "Othello"],
  ["Scottish general who murders King Duncan after a witch's prophecy", "Macbeth"],
  ["Star-crossed lovers from feuding families in Verona", "Romeo and Juliet"],
  ["A weaver named Bottom is given a donkey's head in an enchanted forest", "A Midsummer Night's Dream"],
  ["Magician Prospero controls an island with spirits Ariel and Caliban", "The Tempest"],
  ["Moneylender Shylock demands a pound of flesh as collateral", "The Merchant of Venice"],
  ["Sparring lovers Beatrice and Benedick trade barbs in Sicily", "Much Ado About Nothing"],
  ["Viola disguises herself as Cesario to serve the love-struck Duke Orsino", "Twelfth Night"],
  ["Petruchio woos the sharp-tongued Katharina", "The Taming of the Shrew"],
  ["Rosalind flees to the Forest of Arden disguised as a boy named Ganymede", "As You Like It"],
  ["Aging king divides his kingdom among three daughters — with catastrophic results", "King Lear"],
  ["Julius Caesar is stabbed on the Ides of March by a group of senators", "Julius Caesar"],
  ["Roman general and Egyptian queen share a doomed love affair", "Antony and Cleopatra"],
  ["Scheming hunchbacked king clears every rival on his path to the English throne", "Richard III"],
  ["Sicilian queen Hermione appears to die and is seemingly restored as a statue", "The Winter's Tale"],
  ["Falstaff attempts to court two married women simultaneously in Windsor", "The Merry Wives of Windsor"],
  ["Proud Roman general Caius Marcius is banished and plots revenge with his enemies", "Coriolanus"],
  ["Identical twin brothers cause escalating comic chaos in the city of Ephesus", "The Comedy of Errors"],
  ["King Henry rallies his troops before the Battle of Agincourt in France", "Henry V"],
  ["Angelo imposes draconian laws in Vienna while the Duke watches in disguise", "Measure for Measure"],
  ["Helena cures the King of France and claims Bertram as her husband", "All's Well That Ends Well"],
  ["Timon lavishes gifts on false friends who abandon him in poverty", "Timon of Athens"],
  ["Greek warrior Achilles sulks in his tent while Troy and its heroes clash outside", "Troilus and Cressida"],
  ["Posthumus bets on his wife Imogen's faithfulness with a scheming Italian", "Cymbeline"],
]);

export const constitutionalAmendments = cardsFromPairs([
  ["Amendment I (1791)", "Freedom of religion, speech, press, peaceful assembly, and petition"],
  ["Amendment II (1791)", "Right to keep and bear arms"],
  ["Amendment III (1791)", "Government cannot quarter soldiers in private homes without consent"],
  ["Amendment IV (1791)", "Protection against unreasonable searches and seizures; requires warrants"],
  ["Amendment V (1791)", "Grand jury for serious crimes; no double jeopardy; no self-incrimination; due process; just compensation for seized property"],
  ["Amendment VI (1791)", "Right to a speedy and public trial, impartial jury, and assistance of counsel"],
  ["Amendment VII (1791)", "Right to jury trial in civil cases exceeding twenty dollars"],
  ["Amendment VIII (1791)", "No excessive bail or fines; no cruel and unusual punishment"],
  ["Amendment IX (1791)", "Rights not listed in the Constitution are retained by the people"],
  ["Amendment X (1791)", "Powers not given to the federal government are reserved to the states or the people"],
  ["Amendment XI (1795)", "Citizens cannot sue a state in federal court without the state's consent"],
  ["Amendment XII (1804)", "Revised Electoral College procedure — separate ballots for President and Vice President"],
  ["Amendment XIII (1865)", "Abolished slavery and involuntary servitude, except as punishment for a crime"],
  ["Amendment XIV (1868)", "Citizenship for all born or naturalized in the U.S.; equal protection and due process"],
  ["Amendment XV (1870)", "Right to vote cannot be denied based on race, color, or previous condition of servitude"],
  ["Amendment XVI (1913)", "Congress has the power to levy a federal income tax"],
  ["Amendment XVII (1913)", "U.S. senators are elected directly by the people, not state legislatures"],
  ["Amendment XVIII (1919)", "Prohibition — manufacture, sale, and transport of alcohol banned"],
  ["Amendment XIX (1920)", "Women's suffrage — the right to vote cannot be denied based on sex"],
  ["Amendment XX (1933)", "Presidential term begins January 20; reduces lame-duck period"],
  ["Amendment XXI (1933)", "Repealed Prohibition (the Eighteenth Amendment)"],
  ["Amendment XXII (1951)", "President limited to two terms in office"],
  ["Amendment XXIII (1961)", "Washington D.C. receives Electoral College votes for President"],
  ["Amendment XXIV (1964)", "Poll taxes cannot be used to restrict voting in federal elections"],
  ["Amendment XXV (1967)", "Presidential succession and procedures when the President is incapacitated"],
  ["Amendment XXVI (1971)", "Voting age lowered to 18"],
  ["Amendment XXVII (1992)", "Congressional pay raises cannot take effect until after the next election"],
]);

export const countriesCurrencies = cardsFromPairs([
  ["United States", "Dollar"],
  ["United Kingdom", "Pound Sterling"],
  ["European Union (Germany, France, Italy, Spain, etc.)", "Euro"],
  ["Japan", "Yen"],
  ["China", "Yuan (Renminbi)"],
  ["India", "Rupee"],
  ["Canada", "Dollar"],
  ["Australia", "Dollar"],
  ["Switzerland", "Franc"],
  ["Sweden", "Krona"],
  ["Norway", "Krone"],
  ["Denmark", "Krone"],
  ["Iceland", "Króna"],
  ["Russia", "Ruble"],
  ["Brazil", "Real"],
  ["Mexico", "Peso"],
  ["Argentina", "Peso"],
  ["Chile", "Peso"],
  ["Colombia", "Peso"],
  ["Peru", "Sol"],
  ["South Africa", "Rand"],
  ["Nigeria", "Naira"],
  ["Egypt", "Pound"],
  ["Kenya", "Shilling"],
  ["Ethiopia", "Birr"],
  ["Morocco", "Dirham"],
  ["Saudi Arabia", "Riyal"],
  ["United Arab Emirates", "Dirham"],
  ["Israel", "Shekel"],
  ["Turkey", "Lira"],
  ["Iran", "Rial"],
  ["Iraq", "Dinar"],
  ["Jordan", "Dinar"],
  ["Kuwait", "Dinar"],
  ["Qatar", "Riyal"],
  ["Bahrain", "Dinar"],
  ["Pakistan", "Rupee"],
  ["Bangladesh", "Taka"],
  ["Thailand", "Baht"],
  ["Vietnam", "Dong"],
  ["Indonesia", "Rupiah"],
  ["Malaysia", "Ringgit"],
  ["Philippines", "Peso"],
  ["South Korea", "Won"],
  ["North Korea", "Won"],
  ["Taiwan", "New Dollar"],
  ["Singapore", "Dollar"],
  ["Hong Kong", "Dollar"],
  ["Poland", "Zloty"],
  ["Czech Republic", "Koruna"],
  ["Hungary", "Forint"],
  ["Romania", "Leu"],
  ["Ukraine", "Hryvnia"],
  ["Kazakhstan", "Tenge"],
  ["Uzbekistan", "Som"],
  ["Azerbaijan", "Manat"],
  ["Georgia", "Lari"],
  ["New Zealand", "Dollar"],
  ["Ghana", "Cedi"],
  ["Tanzania", "Shilling"],
  ["Uganda", "Shilling"],
  ["Zambia", "Kwacha"],
  ["Myanmar", "Kyat"],
  ["Cambodia", "Riel"],
  ["Mongolia", "Tögrög"],
  ["Cuba", "Peso"],
]);

export const oscarBestPicture = cardsFromPairs([
  ["1927", "Wings"],
  ["1934", "It Happened One Night"],
  ["1939", "Gone with the Wind"],
  ["1940", "Rebecca"],
  ["1941", "How Green Was My Valley"],
  ["1942", "Mrs. Miniver"],
  ["1943", "Casablanca"],
  ["1944", "Going My Way"],
  ["1945", "The Lost Weekend"],
  ["1946", "The Best Years of Our Lives"],
  ["1953", "From Here to Eternity"],
  ["1954", "On the Waterfront"],
  ["1955", "Marty"],
  ["1957", "The Bridge on the River Kwai"],
  ["1958", "Gigi"],
  ["1959", "Ben-Hur"],
  ["1960", "The Apartment"],
  ["1961", "West Side Story"],
  ["1962", "Lawrence of Arabia"],
  ["1963", "Tom Jones"],
  ["1964", "My Fair Lady"],
  ["1965", "The Sound of Music"],
  ["1966", "A Man for All Seasons"],
  ["1967", "In the Heat of the Night"],
  ["1968", "Oliver!"],
  ["1969", "Midnight Cowboy"],
  ["1970", "Patton"],
  ["1971", "The French Connection"],
  ["1972", "The Godfather"],
  ["1973", "The Sting"],
  ["1974", "The Godfather Part II"],
  ["1975", "One Flew Over the Cuckoo's Nest"],
  ["1976", "Rocky"],
  ["1977", "Annie Hall"],
  ["1978", "The Deer Hunter"],
  ["1979", "Kramer vs. Kramer"],
  ["1980", "Ordinary People"],
  ["1981", "Chariots of Fire"],
  ["1982", "Gandhi"],
  ["1983", "Terms of Endearment"],
  ["1984", "Amadeus"],
  ["1985", "Out of Africa"],
  ["1986", "Platoon"],
  ["1987", "The Last Emperor"],
  ["1988", "Rain Man"],
  ["1989", "Driving Miss Daisy"],
  ["1990", "Dances with Wolves"],
  ["1991", "The Silence of the Lambs"],
  ["1992", "Unforgiven"],
  ["1993", "Schindler's List"],
  ["1994", "Forrest Gump"],
  ["1995", "Braveheart"],
  ["1996", "The English Patient"],
  ["1997", "Titanic"],
  ["1998", "Shakespeare in Love"],
  ["1999", "American Beauty"],
  ["2000", "Gladiator"],
  ["2001", "A Beautiful Mind"],
  ["2002", "Chicago"],
  ["2003", "The Lord of the Rings: The Return of the King"],
  ["2004", "Million Dollar Baby"],
  ["2005", "Crash"],
  ["2006", "The Departed"],
  ["2007", "No Country for Old Men"],
  ["2008", "Slumdog Millionaire"],
  ["2009", "The Hurt Locker"],
  ["2010", "The King's Speech"],
  ["2011", "The Artist"],
  ["2012", "Argo"],
  ["2013", "12 Years a Slave"],
  ["2014", "Birdman"],
  ["2015", "Spotlight"],
  ["2016", "Moonlight"],
  ["2017", "The Shape of Water"],
  ["2018", "Green Book"],
  ["2019", "Parasite"],
  ["2020", "Nomadland"],
  ["2021", "CODA"],
  ["2022", "Everything Everywhere All at Once"],
  ["2023", "Oppenheimer"],
  ["2024", "Anora"],
]);

export const greekRomanGods = cardsFromPairs([
  ["King of the gods; god of the sky and thunder; wields lightning bolts", "Zeus (Greek) / Jupiter (Roman)"],
  ["Queen of the gods; goddess of marriage and family", "Hera (Greek) / Juno (Roman)"],
  ["God of the sea, earthquakes, and horses", "Poseidon (Greek) / Neptune (Roman)"],
  ["God of the underworld and the dead", "Hades (Greek) / Pluto (Roman)"],
  ["Goddess of wisdom, war strategy, and crafts; born fully armored from Zeus's head", "Athena (Greek) / Minerva (Roman)"],
  ["God of the sun, music, poetry, and prophecy; associated with the Oracle at Delphi", "Apollo (Greek) / Apollo (Roman)"],
  ["Goddess of the hunt, the moon, and wild animals; twin of Apollo", "Artemis (Greek) / Diana (Roman)"],
  ["God of war and bloodshed", "Ares (Greek) / Mars (Roman)"],
  ["Goddess of love, beauty, and desire; born from the sea foam", "Aphrodite (Greek) / Venus (Roman)"],
  ["God of fire, the forge, and blacksmiths; threw from Olympus and walked with a limp", "Hephaestus (Greek) / Vulcan (Roman)"],
  ["Messenger of the gods; also guides souls to the underworld and oversees commerce and thieves", "Hermes (Greek) / Mercury (Roman)"],
  ["Goddess of the harvest, grain, and agriculture; mother of Persephone", "Demeter (Greek) / Ceres (Roman)"],
  ["God of wine, festivity, and theater; associated with ecstasy and ritual madness", "Dionysus (Greek) / Bacchus (Roman)"],
  ["Queen of the underworld; spends half the year below ground, causing winter", "Persephone (Greek) / Proserpina (Roman)"],
  ["God of love; shoots arrows that cause people to fall in love", "Eros (Greek) / Cupid (Roman)"],
  ["Goddess of victory; often depicted winged", "Nike (Greek) / Victoria (Roman)"],
  ["Goddess of the hearth and home", "Hestia (Greek) / Vesta (Roman)"],
  ["God of sleep", "Hypnos (Greek) / Somnus (Roman)"],
  ["God of death; twin of Hypnos", "Thanatos (Greek) / Mors (Roman)"],
  ["Goddess of the rainbow; messenger between gods and mortals", "Iris (Greek) / Iris (Roman)"],
  ["God of wild nature, shepherds, and flocks; half-man half-goat; inventor of the pan flute", "Pan (Greek) / Faunus (Roman)"],
  ["Goddess of magic, witchcraft, and crossroads; associated with the moon", "Hecate (Greek) / Trivia (Roman)"],
  ["Titan who rules time and the harvest; father of Zeus; associated with the Golden Age", "Cronus (Greek) / Saturn (Roman)"],
  ["Titan who stole fire from the gods and gave it to humanity", "Prometheus (Greek) / Prometheus (Roman)"],
  ["Primordial goddess of the earth itself", "Gaia (Greek) / Terra (Roman)"],
]);

export const practiceDecks: PracticeDeckConfig[] = [
  {
    slug: "world-capitals",
    title: "World Capitals",
    description: "Drill capitals through flashcards or multiple choice across the full list.",
    promptLabel: "Country",
    answerLabel: "Capital",
    notes: [
      "This deck preserves the wording from your supplied list, including disputed, administrative, and multi-capital entries.",
      "Use flashcards for broad repetition and multiple choice for faster recall checks.",
    ],
    items: worldCapitals,
    questionPrompt: (item) => `What is the capital of ${item.prompt}?`,
    correctFeedback: (item) => `Correct. ${item.answer} is the capital of ${item.prompt}.`,
    incorrectFeedback: (item) => `Not this one. ${item.prompt} matches ${item.answer}.`,
  },
  {
    slug: "us-state-capitals",
    title: "U.S. State Capitals",
    description: "Practice all fifty state capitals with the same flashcard and quiz modes.",
    promptLabel: "State",
    answerLabel: "Capital",
    notes: [
      "This deck covers all 50 U.S. states and their capitals.",
      "Multiple choice pulls distractors from other state capitals in the same deck.",
    ],
    items: usStateCapitals,
    questionPrompt: (item) => `What is the capital of ${item.prompt}?`,
    correctFeedback: (item) => `Correct. ${item.answer} is the capital of ${item.prompt}.`,
    incorrectFeedback: (item) => `Not this one. ${item.prompt} matches ${item.answer}.`,
  },
  {
    slug: "canadian-provinces",
    title: "Canadian Provinces and Territories",
    description: "Memorize provinces, territories, and their capitals across Canada.",
    promptLabel: "Province or Territory",
    answerLabel: "Capital",
    notes: [
      "The deck includes all 10 provinces and 3 territories.",
      "Use this alongside the state-capitals deck if you want a North America geography block.",
    ],
    items: canadianProvincesAndTerritories,
    questionPrompt: (item) => `What is the capital of ${item.prompt}?`,
    correctFeedback: (item) => `Correct. ${item.answer} is the capital of ${item.prompt}.`,
    incorrectFeedback: (item) => `Not this one. ${item.prompt} matches ${item.answer}.`,
  },
  {
    slug: "american-presidents",
    title: "American Presidents and Years",
    description: "Practice presidents against the years they served in office.",
    promptLabel: "President",
    answerLabel: "Years in Office",
    notes: [
      "Grover Cleveland appears twice because his terms were non-consecutive.",
      "This deck reflects the current presidency as of March 20, 2026, with Donald Trump listed as serving from 2025-present.",
    ],
    items: americanPresidentsAndYears,
    questionPrompt: (item) => `What were the presidential term years for ${item.prompt}?`,
    correctFeedback: (item) => `Correct. ${item.prompt} served from ${item.answer}.`,
    incorrectFeedback: (item) => `Not this one. ${item.prompt}'s presidential years were ${item.answer}.`,
  },
  {
    slug: "historic-battles",
    title: "Historic Battles",
    description: "Review major battles and the years or year ranges associated with them.",
    promptLabel: "Battle",
    answerLabel: "Year",
    notes: [
      "This is a compact survey deck rather than an exhaustive military-history timeline.",
      "Some entries use year ranges for campaigns or battles that spanned more than one calendar year.",
    ],
    items: historicBattles,
    questionPrompt: (item) => `When was ${item.prompt}?`,
    correctFeedback: (item) => `Correct. ${item.prompt} was fought in ${item.answer}.`,
    incorrectFeedback: (item) => `Not this one. ${item.prompt} is associated with ${item.answer}.`,
  },
  {
    slug: "shakespeare-plays",
    title: "Shakespeare Plays",
    description: "Match descriptions, characters, and scenarios to the Shakespeare play they come from.",
    promptLabel: "Clue",
    answerLabel: "Play",
    notes: [
      "Each prompt gives a character, scene, or plot point — name the play.",
      "In multiple-choice mode, distractors are drawn from other Shakespeare plays in the deck.",
    ],
    items: shakespearePlays,
    questionPrompt: (item) => `Which Shakespeare play features: ${item.prompt}?`,
    correctFeedback: (item) => `Correct — that's ${item.answer}.`,
    incorrectFeedback: (item) => `Not quite. That clue belongs to ${item.answer}.`,
  },
  {
    slug: "constitutional-amendments",
    title: "U.S. Constitutional Amendments",
    description: "Drill all 27 amendments — number and ratification year to what each one guarantees.",
    promptLabel: "Amendment",
    answerLabel: "What It Guarantees",
    notes: [
      "The first ten amendments (ratified 1791) are collectively known as the Bill of Rights.",
      "Use flashcard mode to read the guarantee and recall the amendment number, or vice versa.",
    ],
    items: constitutionalAmendments,
    questionPrompt: (item) => `What does ${item.prompt} of the U.S. Constitution guarantee?`,
    correctFeedback: (item) => `Correct. ${item.prompt}: ${item.answer}.`,
    incorrectFeedback: (item) => `Not this one. ${item.prompt} covers: ${item.answer}.`,
  },
  {
    slug: "countries-currencies",
    title: "Countries and Currencies",
    description: "Practice matching countries to their official currencies.",
    promptLabel: "Country",
    answerLabel: "Currency",
    notes: [
      "Eurozone countries share the Euro — they appear grouped in one entry.",
      "Some currencies (Dollar, Peso, Franc, Dinar, Riyal) are used by multiple countries; the answer here is always the specific country's version.",
    ],
    items: countriesCurrencies,
    questionPrompt: (item) => `What is the official currency of ${item.prompt}?`,
    correctFeedback: (item) => `Correct. ${item.prompt} uses the ${item.answer}.`,
    incorrectFeedback: (item) => `Not this one. ${item.prompt}'s currency is the ${item.answer}.`,
  },
  {
    slug: "oscar-best-picture",
    title: "Oscar Best Picture Winners",
    description: "Name the film that won the Academy Award for Best Picture for each release year.",
    promptLabel: "Film Year",
    answerLabel: "Best Picture Winner",
    notes: [
      "Years refer to when the film was released (eligible), not the ceremony year — e.g., 1972 → The Godfather.",
      "Years with no entry were omitted from this deck; gaps are mostly pre-1953.",
    ],
    items: oscarBestPicture,
    questionPrompt: (item) => `Which ${item.prompt} film won the Academy Award for Best Picture?`,
    correctFeedback: (item) => `Correct — the ${item.prompt} Best Picture winner was ${item.answer}.`,
    incorrectFeedback: (item) => `Not this one. The Best Picture winner for ${item.prompt} was ${item.answer}.`,
  },
  {
    slug: "greek-roman-gods",
    title: "Greek and Roman Gods",
    description: "Match the domain or description to the correct deity — with both the Greek and Roman names.",
    promptLabel: "Domain / Description",
    answerLabel: "Greek / Roman Name",
    notes: [
      "Each answer gives the Greek name first, then the Roman equivalent in parentheses.",
      "Where the Greek and Roman names are the same (e.g., Apollo), it is listed once.",
    ],
    items: greekRomanGods,
    questionPrompt: (item) => `Which deity is described as: ${item.prompt}?`,
    correctFeedback: (item) => `Correct — ${item.answer}.`,
    incorrectFeedback: (item) => `Not quite. That description fits ${item.answer}.`,
  },
];

export const practiceTopics: PracticeTopic[] = practiceDecks.map((deck) => ({
  slug: deck.slug,
  title: deck.title,
  description: deck.description,
  status: "available",
  href: `/practice/${deck.slug}`,
  itemCount: deck.items.length,
}));

export function getPracticeDeck(slug: string) {
  return practiceDecks.find((deck) => deck.slug === slug);
}
